import dgram from 'dgram'

const ScraperException = (message, isConnectionError = false) => ({
	name: 'ScraperException',
	message,
	isConnectionError,
})

const generateTransactionId = () => Math.floor(Math.random() * 65535)

const sendPacket = (socket, packet, port, hostname) => {
	return new Promise((resolve, reject) => {
		socket.send(packet, 0, packet.length, port, hostname, (err) => {
			if (err) {
				reject(ScraperException(`Failed to send packet: ${err.message}`, true))
			} else {
				resolve()
			}
		})
	})
}

const receiveResponse = (socket, transactionId) => {
	return new Promise((resolve, reject) => {
		socket.once('message', (msg) => {
			const action = msg.readUInt32BE(0)
			const receivedTransactionId = msg.readUInt32BE(4)

			if (receivedTransactionId !== transactionId) {
				reject(ScraperException('Mismatched transaction ID.'))
				return
			}

			if (action === 0) {
				// Connect Response
				resolve({ type: 'connect', connectionId: msg.slice(8, 16) })
			} else if (action === 2) {
				// Scrape Response
				resolve({ type: 'scrape', msg })
			} else if (action === 3) {
				// Error Response
				const errorMsg = msg.toString('utf8', 8)
				reject(ScraperException(`Tracker error: ${errorMsg}`))
			} else {
				reject(ScraperException('Unexpected action in response.'))
			}
		})
	})
}

const scrape = async (url, infohashes, timeout = 2000) => {
	if (!Array.isArray(infohashes)) {
		infohashes = [infohashes]
	}

	infohashes.forEach((hash) => {
		if (!/^[a-f0-9]{40}$/i.test(hash)) {
			throw ScraperException(`Invalid infohash: ${hash}.`)
		}
	})

	const urlMatch = url.match(/udp:\/\/([^:/]*)(?::(\d*))?(?:\/)?/i)
	if (!urlMatch) {
		throw ScraperException('Invalid tracker URL.')
	}

	const [_, hostname, portStr] = urlMatch
	const port = portStr ? parseInt(portStr, 10) : 80

	const transactionId = generateTransactionId()
	const socket = dgram.createSocket('udp4')
	let timer

	try {
		const connectionIdBuffer = Buffer.from('0000041727101980', 'hex')
		const connectPacket = Buffer.alloc(16)

		connectionIdBuffer.copy(connectPacket, 0)
		connectPacket.writeUInt32BE(0, 8) // action: connect
		connectPacket.writeUInt32BE(transactionId, 12)

		await sendPacket(socket, connectPacket, port, hostname)

		const connectResponse = await receiveResponse(socket, transactionId)
		if (connectResponse.type !== 'connect') {
			throw ScraperException('Failed to receive connect response.')
		}

		const { connectionId } = connectResponse
		const scrapePacket = Buffer.alloc(16 + 20 * infohashes.length)

		connectionId.copy(scrapePacket, 0)
		scrapePacket.writeUInt32BE(2, 8) // action: scrape
		scrapePacket.writeUInt32BE(transactionId, 12)

		infohashes.forEach((hash, index) => {
			const hashBuffer = Buffer.from(hash, 'hex')
			hashBuffer.copy(scrapePacket, 16 + index * 20)
		})

		await sendPacket(socket, scrapePacket, port, hostname)

		const scrapeResponse = await receiveResponse(socket, transactionId)
		if (scrapeResponse.type !== 'scrape') {
			throw ScraperException('Failed to receive scrape response.')
		}

		const torrents = {}
		const { msg } = scrapeResponse
		for (let i = 0; i < infohashes.length; i++) {
			const offset = 8 + i * 12
			torrents[infohashes[i]] = {
				seeders: msg.readUInt32BE(offset),
				completed: msg.readUInt32BE(offset + 4),
				leechers: msg.readUInt32BE(offset + 8),
				infohash: infohashes[i],
			}
		}

		return torrents
	} finally {
		clearTimeout(timer)
		socket.close()
	}
}

// Example Usage
;(async () => {
	try {
		const result = await scrape('udp://open.stealth.si:80/announce', [
			'71AF7ABED4F9F161F2443CA7BEDE7D9DA1410573',
			'BD3BC17FC810567AFC1AAD35559E454E5B2453CE',
		])
		console.log(result)
	} catch (error) {
		if (error.name === 'ScraperException') {
			console.error(`Error: ${error.message}`)
			console.error(
				`Connection error: ${error.isConnectionError ? 'yes' : 'no'}`
			)
		} else {
			console.error('Unexpected error:', error)
		}
	}
})()
