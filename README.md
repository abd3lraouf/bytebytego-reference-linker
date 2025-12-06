# ByteByteGo Reference Linker

A Tampermonkey userscript that enhances ByteByteGo course pages by converting `[n]` reference markers into clickable links.

## Features

- **Clickable References**: `[1]`, `[2]`, etc. in the text become clickable links that open the referenced URL in a new tab
- **Quick Navigation**: A `↓` arrow next to each reference scrolls you to the References/Resources section with a highlight effect
- **Hover Tooltips**: Hover over a reference to see the description
- **Multiple Formats Supported**: Works with various reference formats:
  - `[n] Description: URL`
  - `n. Description URL`
  - Ordered lists (`<ol><li>...</li></ol>`)

## Demo

Before:
```
...which significantly reduced load times [22].
```

After:
```
...which significantly reduced load times [22]↓
                                          ^^^^
                                          |  |
                           Opens URL ─────┘  └───── Scrolls to reference
```

## Installation

### Prerequisites
- [Tampermonkey](https://www.tampermonkey.net/) (Chrome, Firefox, Edge, Safari, Opera)
- or [Greasemonkey](https://www.greasespot.net/) (Firefox)
- or [Violentmonkey](https://violentmonkey.github.io/) (Chrome, Firefox, Edge, Opera)

### Install from GitHub (Recommended)

1. Make sure you have Tampermonkey installed
2. Click the link below:

   **[Install ByteByteGo Reference Linker](https://raw.githubusercontent.com/abd3lraouf/bytebytego-reference-linker/main/bytebytego-references.user.js)**

3. Tampermonkey will open and show the installation prompt
4. Click **Install**

### Install from Greasy Fork

Coming soon...

### Manual Installation

1. Open Tampermonkey dashboard
2. Click the `+` tab to create a new script
3. Copy and paste the contents of [`bytebytego-references.user.js`](./bytebytego-references.user.js)
4. Save (Ctrl+S / Cmd+S)

## Usage

1. Navigate to any ByteByteGo course page
2. References like `[1]`, `[22]`, etc. will automatically become interactive:
   - **Click the number** to open the referenced URL in a new tab
   - **Click the `↓` arrow** to scroll down to the reference in the Resources/References section
   - **Hover** to see the reference description

## Supported Sites

- `https://bytebytego.com/*`
- `https://*.bytebytego.com/*`

## How It Works

1. The script scans the page for a References or Resources section (supports `<h2>`, `<h3>` headers)
2. Parses references in various formats and extracts URLs and descriptions
3. Finds all `[n]` markers in the main content
4. Replaces them with clickable links + navigation arrows
5. Uses a MutationObserver to handle dynamically loaded content

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Author

**abd3lraouf** - [GitHub](https://github.com/abd3lraouf)

## Acknowledgments

- ByteByteGo for the amazing system design content
- The Tampermonkey team for making browser scripting accessible
