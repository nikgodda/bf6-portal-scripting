// Usage: node dump-ai.js
// Produces: ai-dump.json (overwritten every time)
// Includes: { "version": "YYYY-MM-DD_HH-mm-ss", "src": {...} }

const fs = require('fs')
const path = require('path')

function dumpDir(dir) {
    const result = {}
    const items = fs.readdirSync(dir, { withFileTypes: true })

    for (const item of items) {
        const fullPath = path.join(dir, item.name)

        if (item.isDirectory()) {
            result[item.name] = dumpDir(fullPath)
        } else if (item.isFile()) {
            result[item.name] = {
                type: 'file',
                content: fs.readFileSync(fullPath, 'utf8'),
            }
        }
    }
    return result
}

;(function run() {
    const root = path.join(__dirname, 'src')

    if (!fs.existsSync(root)) {
        console.error("❌ Folder 'src' not found:", root)
        process.exit(1)
    }

    // Create timestamp version
    const now = new Date()
    const ts =
        now.getFullYear() +
        '-' +
        String(now.getMonth() + 1).padStart(2, '0') +
        '-' +
        String(now.getDate()).padStart(2, '0') +
        '_' +
        String(now.getHours()).padStart(2, '0') +
        '-' +
        String(now.getMinutes()).padStart(2, '0') +
        '-' +
        String(now.getSeconds()).padStart(2, '0')

    const output = {
        version: ts, // <-- version stored inside JSON
        src: dumpDir(root),
    }

    const outFile = 'ai-dump.json' // <-- filename stays fixed

    fs.writeFileSync(outFile, JSON.stringify(output, null, 2), 'utf8')
    console.log(`✅ Dump created: ${outFile}  (version ${ts})`)
})()
