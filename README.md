# Torrent Tracker Scraper

This script allows you to scrape torrent tracker information using UDP trackers to retrieve details such as the number of seeders, leechers, completed downloads, and infohash details for specified torrents.

## Overview

The script utilizes UDP tracker protocol to connect and fetch torrent statistics based on provided infohashes. It is intended to work with publicly available UDP trackers.

## Usage
```js
(async () => {
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
```

|param|description|type|
|--|----|----|
|tracker URL| UDP or TCP URL (e.g., udp://tracker.example.com:port/announce) | String |
|torrent infohash| 40-character hexadecimal strings | String or Array |
