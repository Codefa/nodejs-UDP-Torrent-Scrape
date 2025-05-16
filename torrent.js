import dgram from 'dgram'

class ScraperException extends Error {
	constructor(message, isConnectionError = false) {
		super(message)
		this.name = 'ScraperException'
		this.isConnectionError = isConnectionError
	}
}

const generateTransactionId = () => Math.floor(Math.random() * 65535)

const sendPacket = async (socket, packet, port, hostname) => {
	return new Promise((resolve, reject) => {
		socket.send(packet, 0, packet.length, port, hostname, (err) => {
			if (err) {
				return reject(
					new ScraperException(`Failed to send packet: ${err.message}`, true)
				)
			}
			resolve()
		})
	})
}

const receiveResponse = async (
	socket,
	expectedTransactionId,
	timeout,
	infohashes = []
) => {
	return new Promise((resolve, reject) => {
		let isResolved = false

		const cleanup = () => {
			socket.removeAllListeners('message')
			isResolved = true
		}

		const timer = setTimeout(() => {
			cleanup()
			reject(new ScraperException('Response timed out.', true))
		}, timeout)
		socket.once('message', (msg) => {
			if (isResolved) return
			clearTimeout(timer)

			// Check minimum response length
			if (msg.length < 8) {
				cleanup()
				return reject(new ScraperException('Too short response.'))
			}

			const action = msg.readUInt32BE(0)
			const receivedTransactionId = msg.readUInt32BE(4)

			if (receivedTransactionId !== expectedTransactionId) {
				return reject(new ScraperException('Mismatched transaction ID.'))
			}

			switch (action) {
				case 0: // Connect
					if (msg.length < 16) {
						return reject(new ScraperException('Too short connect response.'))
					}
					return resolve({ type: 'connect', connectionId: msg.slice(8, 16) })

				case 2: // Scrape
					// Check for expected scrape response length
					const expectedLength = 8 + 12 * infohashes.length
					if (msg.length < expectedLength) {
						return reject(new ScraperException('Too short scrape response.'))
					}
					return resolve({ type: 'scrape', msg })

				case 3: // Error
					const errorMsg = msg.toString('utf8', 8)
					return reject(new ScraperException(`Tracker error: ${errorMsg}`))

				default:
					return reject(new ScraperException('Invalid response action.'))
			}
		})
	})
}

const validateInfohashes = (infohashes) => {
	if (!Array.isArray(infohashes)) {
		infohashes = [infohashes]
	}

	if (infohashes.length > 74) {
		throw new ScraperException('Too many infohashes provided.')
	}

	infohashes.forEach((hash) => {
		if (!/^[a-f0-9]{40}$/i.test(hash)) {
			throw new ScraperException(`Invalid infohash: ${hash}.`)
		}
	})

	return infohashes
}

const parseUrl = (url) => {
	const urlMatch = url.match(/^udp:\/\/([^:/]*)(?::([0-9]*))?(?:\/.*)?$/i)
	if (!urlMatch) {
		throw new ScraperException('Invalid tracker URL.')
	}

	const [, hostname, portStr] = urlMatch
	if (!hostname) {
		throw new ScraperException('Missing hostname in tracker URL.')
	}

	const port = portStr ? parseInt(portStr, 10) : 80
	if (port <= 0 || port > 65535) {
		throw new ScraperException('Invalid port number.')
	}

	return { hostname, port }
}

const buildScrapeRequest = (connectionId, transactionId, infohashes) => {
	const scrapePacket = Buffer.alloc(16 + 20 * infohashes.length)
	connectionId.copy(scrapePacket, 0)
	scrapePacket.writeUInt32BE(2, 8) // action: scrape

	scrapePacket.writeUInt32BE(transactionId, 12)

	infohashes.forEach((hash, index) => {
		const hashBuffer = Buffer.from(hash, 'hex')
		hashBuffer.copy(scrapePacket, 16 + index * 20)
	})

	return scrapePacket
}

async function scrape(url, infohashes, timeout = 2000) {
	infohashes = validateInfohashes(infohashes)

	const { hostname, port } = parseUrl(url)
	const socket = dgram.createSocket('udp4')

	socket.on('error', (err) => {
		throw new ScraperException(`UDP socket error: ${err.message}`, true)
	})

	try {
		const transactionId = generateTransactionId()
		const connectionIdBuffer = Buffer.from('0000041727101980', 'hex')
		const connectPacket = Buffer.alloc(16)

		connectionIdBuffer.copy(connectPacket, 0)
		connectPacket.writeUInt32BE(0, 8) // action: connect
		connectPacket.writeUInt32BE(transactionId, 12)

		await sendPacket(socket, connectPacket, port, hostname)

		const connectResponse = await receiveResponse(
			socket,
			transactionId,
			timeout
		)
		if (connectResponse.type !== 'connect') {
			throw new ScraperException('Failed to receive connect response.')
		}

		const { connectionId } = connectResponse
		const scrapePacket = buildScrapeRequest(
			connectionId,
			transactionId,
			infohashes
		)

		await sendPacket(socket, scrapePacket, port, hostname)

		const scrapeResponse = await receiveResponse(
			socket,
			transactionId,
			timeout,
			infohashes
		)
		if (scrapeResponse.type !== 'scrape') {
			throw new ScraperException('Failed to receive scrape response.')
		}

		const torrents = {}
		const { msg } = scrapeResponse
		infohashes.forEach((hash, index) => {
			const offset = 8 + index * 12
			torrents[hash] = {
				seeders: msg.readUInt32BE(offset),
				completed: msg.readUInt32BE(offset + 4),
				leechers: msg.readUInt32BE(offset + 8),
				infohash: hash,
			}
		})

		return torrents
	} finally {
		socket.close()
	}
}

// Example Usage
// ;(async () => {
// 	try {
// 		const result = await scrape('udp://open.stealth.si:80/announce', [
// 			'747A772CD9F952144FE31B977C4D8F89A3F5B227',
// 			'71AF7ABED4F9F161F2443CA7BEDE7D9DA1410573',
// 			'BD3BC17FC810567AFC1AAD35559E454E5B2453CE',
// 		])
// 		console.log(result)
// 	} catch (error) {
// 		if (error instanceof ScraperException) {
// 			console.error(`Error: ${error.message}`)
// 			console.error(
// 				`Connection error: ${error.isConnectionError ? 'yes' : 'no'}`
// 			)
// 		} else {
// 			console.error('Unexpected error:', error)
// 		}
// 	}
// })()

export { scrape }
