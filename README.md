🎨 Kanvas Studio

A lightweight, browser-based visual design editor with a Canva-style workflow and Gemini-powered AI image generation.

Kanvas Studio is a standalone visual design application designed to make creating graphics simple, fast, and flexible. It provides a familiar canvas-based editing experience where users can add text, shapes, images, gradients, shadows, templates, animations, and more—all directly in the browser.

The project combines a vanilla JavaScript front-end editor with a small Node.js server that securely proxies image-generation requests to Gemini.

🌟 What is Kanvas Studio?

Kanvas Studio is built around the idea of giving users a simple creative workspace without requiring a large frontend framework or complicated build system.

You can:

Start with a blank canvas or a template.

Add and arrange visual elements.

Customize typography, colors, gradients, borders, shadows, and opacity.

Upload your own images.

Generate images with Gemini AI.

Animate design elements.

Zoom, align, snap, and organize layers.

Undo and redo changes.

Export finished designs as PNG or JPG.

The current project is intentionally lightweight and easy to inspect, customize, and extend.

✨ Core Features

🖼️ Canvas Editor

The main editor provides a flexible canvas for creating visual compositions.

Elements

Kanvas supports several element types:

Text

Rectangles

Ellipses

Images

Each element can be positioned and customized independently.

Elements have properties such as:

Position

Width

Height

Rotation

Opacity

Fill

Stroke

Border radius

Shadow

Visibility

Lock state

Animation

Flip horizontally

Flip vertically

The editor creates and manages these elements as structured objects, making the design state easy to manipulate. fileciteturn2file5L292-L313

📝 Text Editing

Kanvas includes a text system for creating typography-based designs.

Text elements support:

Custom text

Font size

Font family

Bold

Italic

Text color

Alignment

Positioning

Resizing

Rotation

Opacity

The editor provides default typography properties when a text element is created, while allowing those properties to be customized afterward. fileciteturn2file5L304-L307

🖼️ Image Support

Users can upload images directly from their computer.

The uploaded file is read in the browser and converted into an image element that can be placed on the canvas. fileciteturn2file5L316-L327

Image elements also expose editing properties including:

Grayscale

Brightness

Blur

Opacity

Size

Rotation

Corner radius

Position

This makes Kanvas useful for creating posters, social graphics, thumbnails, banners, cards, and other image-based compositions.

🎨 Advanced Styling

Kanvas includes a collection of visual styling controls.

Fill

Elements can use:

Solid colors

Gradients

Secondary gradient colors

Adjustable gradient angles

Borders

Elements can have:

Custom stroke color

Stroke width

Stroke style

Corners

Rounded corners can be applied to supported elements.

Shadows

Elements can use shadows with configurable shadow properties such as:

Shadow color

Shadow blur

Shadow enable/disable

These controls allow users to create more polished visual compositions without leaving the editor.

📐 Canvas & Layout Tools

Kanvas includes tools intended to make precise design work easier.

Canvas presets

The project includes preset sizes such as:

800 × 500

1080 × 1080

1080 × 1920

1200 × 630

1920 × 1080

Zoom

Users can:

Zoom in

Zoom out

Fit the canvas to the workspace

Zoom to the selected element

The editor dynamically calculates a suitable zoom level based on the available workspace. fileciteturn2file6L340-L359

Grid & snapping

Kanvas includes an optional grid and snap-to-grid workflow.

Users can turn the grid on or off, while element positions can be aligned to the grid size. fileciteturn2file9L519-L537

🧱 Layers & Object Management

The editor treats each design object as an independent layer.

Users can manage their composition through layer operations including:

Selecting elements

Hiding elements

Locking elements

Renaming elements

Reordering elements

Duplicating elements

Copying and pasting

Bringing elements forward

Sending elements backward

Bringing elements to the front

Sending elements to the back

Deleting elements

This provides the basic workflow expected from a modern visual editor.

↩️ Undo & Redo

Kanvas maintains an editor history so users can move backward and forward through changes.

The history system stores snapshots of:

Elements

Selected element

Canvas size

Background

The history is capped at 120 snapshots to keep the editor state manageable. fileciteturn2file5L270-L289

This also makes template application safer because applying a template can be undone.

🧩 Templates

Kanvas contains a built-in template system designed to help users start creating quickly.

The interface provides:

A template browser

Template cards

Ready-made compositions

Template application

Undo support

The current enhancement pack adds a dedicated template modal and starter templates such as Bold announcement. fileciteturn2file8L446-L460

Templates are intended to provide a starting point rather than forcing users to build every composition from an empty canvas.

🎬 Animation System

Kanvas includes lightweight animation support using GSAP.

Available animation presets include:

Fade

Slide Up

Slide Left

Pop

Spin

The editor can play the configured animations on canvas elements through the animation preview control. fileciteturn2file6L365-L385

This allows static designs to be turned into simple animated compositions.

🤖 Gemini AI Image Generation

One of Kanvas Studio's main features is its integrated AI image-generation workflow.

Instead of exposing the Gemini API key in browser JavaScript, the project uses a local Node.js server as a proxy.

Workflow

User
  ↓
Kanvas AI Panel
  ↓
POST /api/generate-image
  ↓
Local Node.js Server
  ↓
Gemini Image API
  ↓
Generated Image
  ↓
Kanvas Canvas

The AI panel allows the user to provide:

An image prompt

A visual style

An aspect ratio

The browser sends these values to the local API endpoint. fileciteturn2file7L411-L430

The server then enhances the prompt, sends it to the configured Gemini image-capable model, extracts the returned image data, and sends it back to the browser. fileciteturn2file1L51-L63

🔐 API Key Security

The Gemini API key is intentionally kept on the server.

The server reads:

GEMINI_API_KEY=your_key_here

from the environment instead of embedding the key in frontend JavaScript.

The server configuration uses:

const apiKey = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';

fileciteturn2file4L216-L225

This is important because putting an API key directly into app.js or index.html would expose it to every browser user.

Never commit your real .env file to GitHub.

📤 Export

Kanvas can export the current canvas as an image.

Supported formats:

PNG

JPG

Export options include:

Rendering scale

Transparent background

Canvas background

The editor temporarily removes selection and grid visuals before rendering the export, then restores the editor state afterward. fileciteturn2file3L174-L198

The exported files are named:

kanvas-export.png

or

kanvas-export.jpg

💾 Save & Project State

The current Save functionality stores project snapshots in the application's session memory.

A saved snapshot includes:

Timestamp

Elements

Canvas background

The current implementation is not a cloud database and does not provide permanent multi-device project storage. fileciteturn2file6L388-L394

This distinction is important for anyone deploying or extending the project.

A future version could replace this with:

LocalStorage

IndexedDB

A REST API

Cloud database storage

User accounts

Cloud project synchronization

⌨️ Keyboard Shortcuts

Kanvas provides keyboard shortcuts for common editing actions.

Action

Shortcut

Undo

Ctrl + Z

Redo

Ctrl + Shift + Z

Duplicate

Ctrl + D

Copy

Ctrl + C

Paste

Ctrl + V

Delete

Delete / Backspace

Move

Arrow keys

Faster movement

Shift + Arrow

Bring forward

]

Send backward

[

Bring to front

Ctrl + ]

Send to back

Ctrl + [

Deselect

Escape

Zoom in

+

Zoom out

-

Reset zoom

0

Shortcuts help

?

🛠️ Technology Stack

Kanvas Studio intentionally uses a lightweight technology stack.

Frontend

HTML5

CSS3

Vanilla JavaScript

Backend

Node.js

Node.js built-in HTTP server

Native fetch

AI

Gemini API

Gemini image-capable model

Animation

GSAP

Export

html2canvas

Fonts

Google Fonts

There is no React, Vue, Angular, or other frontend framework required by the current project.

There is also no required bundler or frontend build pipeline.

📁 Project Structure

kanvas-studio/
│
├── index.html
│   └── Main editor interface and application markup
│
├── styles.css
│   └── Editor layout, panels, controls, canvas styling, and responsive styles
│
├── app.js
│   └── Editor engine, state, interactions, layers, templates,
│       animations, keyboard shortcuts, export, and AI interface
│
├── server.mjs
│   └── Local Node.js server, static-file serving, and Gemini proxy
│
├── .env.example
│   └── Environment variable template
│
├── .gitignore
│   └── Files that should not be committed
│
└── README.md
    └── Project documentation

The project README itself identifies index.html, styles.css, app.js, and server.mjs as the primary application files. fileciteturn2file0L11-L20

🚀 Installation

Requirements

You need:

Node.js 18 or newer

A modern web browser

A Gemini API key for AI image generation

1. Clone the repository

git clone https://github.com/YOUR_USERNAME/kanvas-studio.git
cd kanvas-studio

Replace YOUR_USERNAME with your GitHub username.

2. Create your environment file

Copy:

.env.example

to:

.env

macOS / Linux

cp .env.example .env

Windows PowerShell

Copy-Item .env.example .env

3. Add your Gemini API key

Open .env:

GEMINI_API_KEY=paste_your_gemini_api_key_here
GEMINI_IMAGE_MODEL=gemini-2.5-flash-image
PORT=3000

Do not put the API key inside:

index.html
app.js
styles.css

▶️ Run Kanvas Studio

Start the local server:

node --env-file=.env server.mjs

The server serves the editor and exposes the AI endpoint.

Open:

http://localhost:3000

The project's server listens on the configured PORT, defaulting to 3000. fileciteturn2file4L221-L224

🔌 API Endpoint

The application exposes one main API endpoint for AI image generation:

POST /api/generate-image

Request

{
  "prompt": "A futuristic city at sunset",
  "style": "Editorial",
  "aspectRatio": "1:1"
}

Server processing

The server:

Checks for GEMINI_API_KEY.

Reads the prompt.

Reads the requested style.

Reads the requested aspect ratio.

Enhances the prompt.

Calls the configured Gemini model.

Finds the returned image data.

Converts it to an image data URL.

Sends the image back to the editor.

The implementation also rejects missing prompts and handles Gemini/API errors. fileciteturn2file1L241-L255

🧪 Example AI Workflow

A user might enter:

A futuristic electric sports car in a neon city at night

Then choose:

Style: Editorial
Aspect Ratio: 16:9

Kanvas sends the request to the local server.

The server builds an enhanced prompt and requests an image from Gemini.

When the image is returned, Kanvas automatically adds it as a new image element on the canvas. fileciteturn2file7L418-L431

🐛 Troubleshooting

Missing GEMINI_API_KEY

Make sure .env exists in the project root:

GEMINI_API_KEY=your_key_here

Then restart the server.

Gemini returns no image

Check:

GEMINI_IMAGE_MODEL=gemini-2.5-flash-image

The configured model needs to support image generation.

The server reports an error when Gemini responds without usable image data. fileciteturn2file1L58-L62

Port is already being used

Change:

PORT=3000

to another available port:

PORT=3001

Restart the server and open the new port in your browser.

🔒 Important Security Notice

Never commit your real .env file.

A public GitHub repository should contain:

.env.example

but not:

.env

The .env.example file should contain only a placeholder:

GEMINI_API_KEY=paste_your_gemini_api_key_here

If a real API key has already been uploaded publicly, revoke or rotate that key before publishing the repository.

🧭 Current Project Scope

Kanvas Studio currently provides a strong foundation for a browser-based design editor, but it should not be described as a full production Canva replacement.

The current implementation is focused on:

Local editing

Canvas composition

Basic design tools

Templates

Animations

Image upload

AI image generation

Image export

Session-based saving

Features such as accounts, cloud storage, real-time collaboration, and permanent project databases are not currently part of the demonstrated implementation.

🚧 Future Roadmap

Potential future development areas include:

Project management

Persistent projects

LocalStorage/IndexedDB persistence

Cloud project storage

Project thumbnails

Autosave

Version history

Collaboration

User accounts

Shared projects

Real-time collaboration

Comments

Permissions

Team workspaces

Design tools

More shapes

SVG support

Advanced vector editing

Guides

Smart alignment

Rulers

More advanced typography

Multi-page documents

AI

AI image editing

Image variations

Background removal

AI background generation

AI object replacement

AI design suggestions

Text-to-design workflows

Export

PDF export

SVG export

Animated export

Higher-resolution rendering

These are roadmap ideas, not claims about features already implemented.

🤝 Contributing

Contributions are welcome.

A typical contribution workflow:

git checkout -b feature/my-new-feature

Make your changes, test them locally, then commit:

git add .
git commit -m "Add my new feature"
git push origin feature/my-new-feature

Open a pull request on GitHub with a clear explanation of the change.

📜 License

No license is currently specified by the supplied project files.

If you publish this project publicly, add a license that matches how you want others to use, modify, and redistribute the source code.

⭐ Project Summary

Kanvas Studio is a lightweight creative editor that brings together:

Design tools + Templates + Layers + Animation + Image editing + Gemini AI

The architecture is intentionally simple:

                 ┌─────────────────────┐
                 │     Kanvas UI       │
                 │ HTML + CSS + JS     │
                 └──────────┬──────────┘
                            │
             ┌──────────────┼──────────────┐
             │              │              │
             ▼              ▼              ▼
        Canvas Editor    Templates     Animations
             │
             │
             ├───────────────┐
             │               │
             ▼               ▼
        Image Upload      Export
             │
             ▼
       AI Image Panel
             │
             ▼
      /api/generate-image
             │
             ▼
       Node.js Server
             │
             ▼
        Gemini API
             │
             ▼
       Generated Image
             │
             ▼
          Canvas

Kanvas Studio is designed to be easy to understand, easy to run locally, and easy to extend into a larger creative platform.
