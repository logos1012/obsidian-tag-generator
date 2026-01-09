# Obsidian Tag Generator

An Obsidian plugin that automatically generates tags from your notes and adds them to the frontmatter.

## Features

- **Automatic Tag Generation**: Analyzes your note content and generates relevant tags
- **AI-Powered Tag Refinement** (v1.1.0+):
  - Uses OpenAI to refine and improve generated tags
  - Removes irrelevant words like "있었다", "이렇게", "거다"
  - Converts words to their base forms
  - Ensures only meaningful tags are included
- **Smart Keyword Extraction**:
  - Extracts proper nouns, acronyms, and important terms
  - Handles both Korean and English text
  - Identifies dates, amounts, and numbers
  - Gives higher weight to words in the note title
- **Frontmatter Management**:
  - Safely adds tags to existing frontmatter
  - Creates frontmatter if it doesn't exist
  - Option to merge with or overwrite existing tags
- **Bulk Processing**: Generate tags for all notes in your vault at once
- **Customizable Settings**:
  - Maximum number of tags per note
  - Minimum word length for tags
  - Exclude specific folders from processing
  - AI model selection (GPT-3.5 Turbo, GPT-4, GPT-4 Turbo)

## Installation

### Using BRAT

1. Install BRAT plugin if you haven't already
2. Add this repository: `https://github.com/[your-username]/obsidian-tag-generator`
3. Enable the plugin in Obsidian settings

### Manual Installation

1. Download the latest release from GitHub
2. Extract `main.js` and `manifest.json` to your vault's plugins folder: `<vault>/.obsidian/plugins/tag-generator/`
3. Reload Obsidian
4. Enable the plugin in Settings > Community plugins

## Usage

### Generate Tags for Current Note
- Click the tag icon in the ribbon, or
- Use Command Palette: `Tag Generator: Generate tags for current note`

### Generate Tags for All Notes
- Use Command Palette: `Tag Generator: Generate tags for all notes in vault`

## Settings

### AI Settings
- **Use AI for tag refinement**: Enable OpenAI integration for better tag quality
- **OpenAI API Key**: Your OpenAI API key (required for AI features)
- **AI Model**: Choose from various models:
  - GPT-3.5 Turbo
  - GPT-4, GPT-4 Turbo, GPT-4o (Optimized)
  - o1 models for advanced reasoning (o1, o1-preview, o1-mini)

### General Settings
- **Maximum number of tags**: How many tags to generate per note (default: 10)
- **Overwrite existing tags**: Replace existing tags or merge with them (default: false)
- **Minimum word length**: Minimum character length for tag candidates (default: 2)
- **Excluded folders**: List of folders to exclude from tag generation

## How It Works

The plugin analyzes your note content to identify important keywords:

1. **Title Analysis**: Words from the note title receive triple weight
2. **Proper Nouns**: Company names, people, places get double weight
3. **Content Keywords**: Important terms from the note body
4. **Special Patterns**: Dates, monetary amounts, statistics

The plugin removes common stop words and grammatical particles to focus on meaningful content.

## Support

If you encounter any issues or have suggestions, please file an issue on GitHub.

## License

MIT