# NodeJS UDP Torrent Scraper

A Node.js implementation for scraping torrent status from UDP trackers. Includes both a reusable scraping module and a web interface demo.

## Usage as a Module

You can use this module in your project in two ways:

### 1. Add as a dependency in your project

Add this repository as a dependency in your `package.json`:

```json
{
	"dependencies": {
		"nodejs-udp-torrent-scrape": "github:codefa/nodejs-udp-torrent-scrape"
	}
}
```

### Example Usage

```javascript
import { scrape } from 'nodejs-udp-torrent-scrape'

try {
	// Single infohash
	const result = await scrape(
		'udp://tracker.example.com:6969/announce',
		'7c18267426e81e849f282d1f9a10cf5a6a292c8c'
	)
	console.log(result)

	// Multiple infohashes (max 74)
	const results = await scrape('udp://tracker.example.com:6969/announce', [
		'7c18267426e81e849f282d1f9a10cf5a6a292c8c',
		'71af7abed4f9f161f2443ca7bede7d9da1410573',
	])
	console.log(results)
} catch (error) {
	console.error(`Error: ${error.message}`)
	console.error(`Connection error: ${error.isConnectionError ? 'yes' : 'no'}`)
}
```

### Response Format

```javascript
{
    "7c18267426e81e849f282d1f9a10cf5a6a292c8c": {
        "infohash": "7c18267426e81e849f282d1f9a10cf5a6a292c8c",
        "seeders": 10,
        "completed": 100,
        "leechers": 5
    }
}
```

### API Reference

#### scrape(url, infohash[, timeout])

- `url` (String): Tracker URL (e.g., "udp://tracker.example.com:6969/announce")
- `infohash` (String|Array): Single infohash or array of infohashes (max 74). Must be 40-character hex strings.
- `timeout` (Number, optional): Timeout in milliseconds (default: 2000)
- Returns: Promise resolving to an object with infohash keys and torrent data values
- Throws: ScraperException with isConnectionError property

### Error Handling

The library throws `ScraperException` with detailed error messages and a boolean `isConnectionError` property to distinguish between connection issues and other errors.

```javascript
try {
	await scrape(url, infohash)
} catch (error) {
	if (error.isConnectionError) {
		// Handle connection issues (timeouts, unreachable host, etc.)
	} else {
		// Handle other errors (invalid input, protocol errors, etc.)
	}
}
```

## Running the Web Interface

This project includes a web interface to easily scrape torrent trackers:

1. Start the server:

   ```bash
   npm start
   ```

2. Open [http://localhost:3020](http://localhost:3020) in your browser.

3. Use the web interface:
   - Paste a valid magnet link
   - Click "Scrape"
   - View results in the table showing Tracker, Protocol, Status, Seeders, Completed, and Leechers

### Demo Features

- Clean, responsive UI with Tailwind CSS
- Real-time scraping of UDP trackers
- Detailed error reporting
- Support for magnet links with multiple trackers
- Concurrent tracker scraping

## Technical Details

- Uses Node's native `dgram` module for UDP communication
- Supports both single and batch infohash scraping
- Implements proper timeout handling and cleanup
- Follows UDP tracker protocol specification
- Written in modern JavaScript with async/await

## License

Licensed under the MIT License. See the LICENSE file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
