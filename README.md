# NodeJS UDP Torrent Scrape

This project scrapes torrent trackers using UDP requests. It includes:

- A backend built with Express to handle scraping requests.
- A UDP-based scraper in `torrent.js` using Node's `dgram` module.
- A simple frontend in `index.html` styled with Tailwind CSS for input and results display.

## Installation

1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```

## Usage

1. Start the server:
   ```bash
   npm start
   ```
2. Open your browser and navigate to [http://localhost:3020](http://localhost:3020).

3. Use the web interface:
   - Paste a valid magnet link into the input field.
   - Click the **Scrape** button.
   - The backend will query all UDP trackers present in the magnet link and display the results in a responsive table with details including Tracker, Status, Seeders, Completed, and Leechers.

## scrape function params

| param            | description                                                     | type            |
| ---------------- | --------------------------------------------------------------- | --------------- |
| tracker URL      | UDP tracker URL (e.g., udp://tracker.example.com:port/announce) | String          |
| torrent infohash | 40-character hexadecimal strings                                | String or Array |
