import express from 'express'
import bodyParser from 'body-parser'
import { scrape } from './torrent.js'

const app = express()
const PORT = 3020

app.use(bodyParser.json())
app.use(express.static('.')) // serve index.html and other static assets

app.post('/scrape', async (req, res) => {
	// Expecting { magnet: 'magnet:?...' }
	try {
		const { magnet } = req.body
		if (!magnet || !magnet.startsWith('magnet:?')) {
			return res.status(400).json({ error: 'Invalid magnet link.' })
		}

		// Remove 'magnet:?' prefix and parse parameters
		const params = new URLSearchParams(magnet.slice(8))
		const xt = params.get('xt')
		if (!xt || !xt.includes('btih:')) {
			return res.status(400).json({ error: 'Missing infohash (xt parameter).' })
		}
		const infohash = xt.split('btih:')[1].toUpperCase()
		if (infohash.length !== 40) {
			return res
				.status(400)
				.json({ error: 'Infohash must be 40 hexadecimal characters.' })
		}

		// Get all trackers and filter for UDP trackers
		const trackers = params
			.getAll('tr')
			.filter((tracker) => tracker.toLowerCase().startsWith('udp://'))
		if (trackers.length === 0) {
			return res
				.status(400)
				.json({ error: 'No UDP trackers found in magnet link.' })
		}

		// For each tracker, call scrape() concurrently
		const results = await Promise.all(
			trackers.map(async (tracker) => {
				try {
					const data = await scrape(tracker, [infohash])
					return { tracker, data }
				} catch (error) {
					return { tracker, error: error.message }
				}
			})
		)
		res.json({ infohash, results })
	} catch (error) {
		res.status(500).json({ error: error.message })
	}
})

app.listen(PORT, () => {
	console.log(`Server running at http://localhost:${PORT}`)
})
