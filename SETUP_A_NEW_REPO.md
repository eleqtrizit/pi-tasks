# Setting Up a New Pi Coding Agent Extension Repository

This guide walks you through creating a new Pi Coding Agent extension from scratch, using this repository as a template. Follow these steps to set up the bare bones of your own extension.

## Prerequisites

- **Node.js** (v18+ recommended)
- **npm** or **pnpm**
- **TypeScript** knowledge
- A GitHub account (for publishing)

---

## Setup 1:  Nevermind on this I deleted it

## Step 2: Initialize the Project

```bash
npm init -y
```

---

## Step 3: Install Dependencies

You need the Pi Coding Agent type definitions and some development tools:

```bash
npm install --save-dev typescript ts-node vitest @types/node
npm install @sinclair/typebox uuid
npm install --save-peer @mariozechner/pi-coding-agent @sinclair/typebox
```

> **Note:** The `peerDependencies` are required by Pi to load your extension. The `@mariozechner/pi-coding-agent` package provides the `ExtensionAPI` type.

---

## Step 4: Create TypeScript Configuration

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["src/**/*", "extensions/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## Step 5: Update package.json

Update your `package.json` with the proper Pi extension configuration:

```json
{
  "name": "my-pi-extension",
  "version": "0.1.0",
  "description": "My custom Pi Coding Agent extension",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/YOUR_USERNAME/my-pi-extension.git"
  },
  "author": "Your Name",
  "license": "MIT",
  "keywords": ["pi-package"],
  "main": "extensions/index.ts",
  "files": [
    "extensions",
    "skills",
    "src",
    "package.json",
    "README.md"
  ],
  "dependencies": {
    "uuid": "^11.0.0"
  },
  "peerDependencies": {
    "@mariozechner/pi-coding-agent": "*",
    "@sinclair/typebox": "*"
  },
  "pi": {
    "image": "https://raw.githubusercontent.com/YOUR_USERNAME/my-pi-extension/main/extension-icon.png",
    "extensions": [
      "extensions/index.ts"
    ],
    "skills": [
      "skills"
    ]
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "ts-node": "^10.9.0",
    "typescript": "^5.0.0",
    "vitest": "^1.0.0"
  }
}
```

**Key fields explained:**
- `main`: Entry point that Pi will load (must be `extensions/index.ts`)
- `keywords`: Must include `"pi-package"` for Pi to recognize it
- `pi`: Pi-specific configuration
  - `extensions`: Array of extension entry points
  - `skills`: Directory containing skill markdown files

---

## Step 6: Create the Folder Structure

Create the following directories:

```bash
mkdir -p extensions src/utils skills
```

---

## Step 7: Create a Basic "Hello World" Extension

Create `extensions/index.ts`:

```typescript
import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';
import { Type } from '@sinclair/typebox';

/**
 * Default export - this is the entry point Pi uses to load your extension.
 * It receives the Pi ExtensionAPI which provides access to:
 * - pi.registerTool(): Register custom tools
 * - pi.on(): Subscribe to events (session_start, turn_start, turn_end, etc.)
 * - pi.sendUserMessage(): Send messages to the user
 * - ctx.modelRegistry: Access available models
 * - ctx.ui: UI utilities (notify, setStatus, etc.)
 */
export default function (pi: ExtensionAPI) {
    // Register event handlers
    pi.on('session_start', async (event, ctx) => {
        ctx.ui.notify('My extension loaded!', 'info');
    });

    // Register a custom tool
    pi.registerTool({
        name: 'hello_world',
        label: 'Hello World',
        description: 'A simple hello world tool demonstration.',
        parameters: Type.Object({
            name: Type.String({ description: 'Name to greet' })
        }),
        async execute(toolCallId, params, signal, onUpdate, ctx) {
            const greeting = `Hello, ${params.name}! Welcome to my Pi extension.`;
            
            return {
                content: [{ type: 'text', text: greeting }],
                details: { name: params.name }
            };
        }
    });

    pi.registerTool({
        name: 'echo',
        label: 'Echo',
        description: 'Echo back the input text.',
        parameters: Type.Object({
            message: Type.String()
        }),
        async execute(toolCallId, params, signal, onUpdate, ctx) {
            return {
                content: [{ type: 'text', text: params.message }],
                details: {}
            };
        }
    });
}
```

---

## Step 8: Create a Basic Skill (Optional)

Skills provide documentation that Pi agents can read to understand how to use your tools.

Create `skills/hello.md`:

```markdown
---
description: A simple hello world extension demonstrating basic tool registration.
---

# Hello World Extension

This extension demonstrates how to build a basic Pi Coding Agent extension.

## Available Tools

### hello_world
Greets the user by name.

**Parameters:**
- `name` (string): The name of the person to greet

**Example:**
```
hello_world(name="Developer")
```

### echo
Echoes back the provided message.

**Parameters:**
- `message` (string): The message to echo back

**Example:**
```
echo(message="Hello!")
```
```

---

## Step 9: Create a .gitignore File

Create `.gitignore`:

```
node_modules/
dist/
*.log
.DS_Store
```

---

## Step 10: Test Your Extension Locally

1. **Build the extension** (if you have any build steps):
   ```bash
   npx tsc
   ```

2. **Link your extension** to Pi:
   ```bash
   npm link
   ```
   
   Then in your Pi project:
   ```bash
   npm link my-pi-extension
   ```

3. **Run Pi with your extension**:
   
   > **Important:** Use an absolute path or `$(pwd)` for the extension path.
   ```bash
   # From your project directory, use $(pwd) for absolute path:
   pi --extension $(pwd)/extensions/index.ts
   
   # Or use the full absolute path:
   pi --extension ~/path/to/your-extension/extensions/index.ts
   ```

---

## Step 11: Publish to npm (Optional)

When you're ready to share your extension:

1. Update version in `package.json`
2. Create a GitHub release
3. Publish to npm:
   ```bash
   npm publish
   ```

---

## Step 12: Install Your Extension in Pi

Once published (or linked locally), users can install your extension by adding it to their Pi configuration or running:

```bash
pi extension install my-pi-extension
```

---

## Summary of Required Files

| File/Directory | Purpose |
|----------------|---------|
| `package.json` | Project metadata with `pi` config |
| `tsconfig.json` | TypeScript configuration |
| `extensions/index.ts` | Main extension entry point |
| `skills/` | (Optional) Skill documentation |
| `.gitignore` | Ignore node_modules, dist, etc. |

---

## Key Concepts

### Extension API
The `ExtensionAPI` provides:
- `pi.registerTool()` - Register custom tools for agents to use
- `pi.on(event, handler)` - Subscribe to Pi events
- `pi.sendUserMessage()` - Send messages to the user
- `ctx.modelRegistry` - Access available AI models
- `ctx.ui` - UI utilities (notifications, status bar)

### Events You Can Handle
- `session_start` - When a new Pi session starts
- `before_agent_start` - Before an agent starts (modify system prompt)
- `turn_start` - Each agent turn begins
- `turn_end` - Each agent turn ends
- `session_end` - When session ends

### Tool Registration
Tools must have:
- `name`: Unique identifier
- `label`: Human-readable label
- `description`: What the tool does
- `parameters`: TypeBox schema for parameters
- `execute`: Async function that runs the tool

