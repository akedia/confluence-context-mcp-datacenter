# Confluence Cloud MCP Server

A Model Context Protocol (MCP) server that provides tools for interacting with Confluence Cloud. This server enables AI assistants to manage Confluence spaces, pages, and content through a standardized interface.

[![CI/CD Pipeline](https://github.com/aaronsb/confluence-cloud-mcp/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/aaronsb/confluence-cloud-mcp/actions/workflows/ci-cd.yml)

## Features

- Space Management
  - List spaces
  - Get space details
- Page Operations
  - Create, read, update pages
  - List pages in a space
  - Convert page content from Confluence storage format to Markdown
- Search & Labels
  - Search content using CQL
  - Manage page labels

## Setup


1. Clone the repository:
```bash
git clone https://github.com/akedia/confluence-context-mcp-datacenter.git
cd confluence-cloud-mcp
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
Create a `.env` file with your Confluence credentials:
```
CONFLUENCE_DOMAIN=your-domain.atlassian.net
CONFLUENCE_EMAIL=your-name
CONFLUENCE_API_TOKEN=your-api-token
```

3. Build the project:
```bash
npm run build
```

4. Run the server:
```bash
node build/index.js
```


> **Note for AI Assistants**: If you're an AI assistant like Cline trying to install this MCP server, please refer to the [llms-install.md](llms-install.md) file for detailed installation instructions.

## Available Tools

### Space Tools
- `list_confluence_spaces`: List all spaces in Confluence
- `get_confluence_space`: Get details about a specific space

### Page Tools
- `list_confluence_pages`: List pages in a space
- `get_confluence_page`: Get a specific page with its content (now includes Markdown conversion)
- `create_confluence_page`: Create a new page in a space
- `update_confluence_page`: Update an existing page

The `get_confluence_page` tool now automatically converts Confluence storage format content to Markdown, making it easier to work with page content. The conversion handles:
- Headers (h1-h6)
- Lists (ordered and unordered)
- Links
- Emphasis (bold/italic)
- Code blocks
- Tables
- Paragraphs and line breaks

### Search & Label Tools
- `search_confluence_pages`: Search Confluence content using CQL
- `get_confluence_labels`: Get labels for a page
- `add_confluence_label`: Add a label to a page
- `remove_confluence_label`: Remove a label from a page

> **Note**: All tool names follow the [verb]_confluence_[noun] naming convention for consistency and clarity.

## Development

This project is written in TypeScript and follows the MCP SDK conventions for implementing server capabilities. The codebase is organized into:

- `src/client/` - Confluence API client implementation
- `src/handlers/` - MCP tool request handlers
- `src/schemas/` - JSON schemas for tool inputs
- `src/types/` - TypeScript type definitions
- `src/utils/` - Utility functions including content format conversion

### CI/CD Pipeline

This project uses GitHub Actions for continuous integration and deployment:

- Automated testing and linting on pull requests
- Automatic Docker image builds on main branch commits
- Multi-architecture image builds (amd64, arm64)
- Container publishing to GitHub Container Registry

### Local Development

For local development, use the provided scripts:

- `./scripts/build-local.sh`: Builds the project and creates a local Docker image
- `./scripts/run-local.sh`: Runs the local Docker image with your credentials

## License

MIT
