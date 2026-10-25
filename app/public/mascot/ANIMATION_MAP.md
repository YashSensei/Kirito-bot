# Miles mascot motion

The original 20 PNGs are reference illustrations, not a sequence of animation frames. Each agent keeps one retro device body. SVG layers animate its eyes, display, controls and physical movement without replacing that illustration.

Large mascots in both side panels move only during pointer hover or visible keyboard focus. Unread sidebar activity also gives a gentle notification loop until the server marks it read. Running tasks do not automatically move either large mascot. The centered chat header has a static mascot above the name; historic messages have no avatars. `ChatActivity.svelte` uses the agent's actual 40px retro mascot and chosen palette for the current turn, including its animated writing nib, typing cursor, scanning eyes and built-in controls. Activity, file, memory and search-result avatars stay still.

The implementation is in `src/components/ComputerAvatar.svelte`; `src/lib/mascot.ts` defines the devices and task mapping. `BotAvatar.svelte` follows that agent's current run and live activity, but gates playback on interaction or unread activity. Hovering anywhere in a sidebar bot row keeps a gentle repeating gesture running, including while the agent is resting. Leaving the row stops it unless it still has unread activity or visible keyboard focus. The right profile follows the same hover/focus rule. Reduced-motion preferences suppress all motion, and hidden avatars pause their animations.

## Devices

| Mascot | Existing shape key | Working motion | Hover greeting |
| --- | --- | --- | --- |
| Classic CRT | blob | Gentle nod | Small tilt |
| Compact PC | cloud | Gentle lift | Small lift |
| Outline terminal | square | Gentle lean | Small tilt |
| CD player | sparkle | Gentle nod and slow disc rotation | Small tilt |
| Cassette player | clover | Gentle nod and slow reels | Small tilt |
| Retro radio | heart | Gentle nod and dial adjustment | Small tilt |
| Chat terminal | flower | Gentle nod | Small tilt |
| Handheld console | teardrop | Gentle lift | Small tilt |
| Pocket pager | tablet | Gentle lift | Small tilt |
| Compact camera | wedge | Gentle nod and lens adjustment | Small tilt |
| Record player | house | Gentle nod and slow record rotation | Small tilt |
| Floppy disk | star | Gentle lean | Small tilt |
| Tilted CRT | hex | Gentle lean | Small tilt |

Body movement stays within one degree and one SVG pixel. It uses a single slow gesture, with no flips, body spins, squash, perspective distortion or chained gestures. Writing keeps the body stationary while the nib draws inside its screen. Motion phases derive from each agent's identity; the small chat mascot's screen and built-in controls communicate its actual task.

## Task actions

| Activity | Display and control action |
| --- | --- |
| Thinking / general work | Eyes look around |
| Streaming a reply | Code lines appear, cursor advances, built-in keys press |
| Writing a file, note or memory | Three handwriting strokes draw with a moving nib inside the screen |
| Search, read, browse or research | Scan line and tracking eyes; camera focus / radio tuning where applicable |
| Connecting or authenticating | Inward connection chevrons and control presses |
| Update, install or download | Progress line and control presses |
| Queued or waiting for approval | Waiting expression and small indicator |
| Sleeping / offline | Closed eyes, static body |
| Finished / needs attention | Static expression; no continuing task motion |

The latest event must belong to the agent's current run. New tool actions override old accumulated response text, and completion stops the motion. Historic messages have no avatars.

## Computer interaction

The compact computer is a single rounded surface. Clicking the sleeping card wakes it; the real rendered framebuffer replaces that card automatically. Its only normal caption is the agent's screen name. Clicking the live preview opens an expanded view without acquiring another watching lease or remounting the viewer. One rounded Watching / Take control bar appears beneath the expanded screen. Returning control or closing the expanded view restores view mode. Sleep lives in the expanded view's top controls. Stream deadlines, provider status checks, lease renewal and errors remain available only when needed. The expanded view traps keyboard focus, makes surrounding UI inert, and restores preview focus on exit.

## Palette and artwork

A user chooses one of eleven accent colors. The warm cream casing, black display and paper texture remain intact; a blue-material mask recolors only the accent parts. The chosen blend stays fixed throughout every task and hover until the user edits it. There is no floating color wash, framing tile or detached decorative prop around the agent mascot.

Generated source PNGs and their prompts are kept under `rig/` and `rig/prompts/`. The app loads optimized, lossless 512px WebP bodies. These thirteen assets were generated with the installed imagegen CLI, Azure configuration from `OPENAI_BASE_URL` / `OPENAI_API_KEY`, and model `gpt-image-2.5-sunburst`. No video model is required for these interactive layer animations.

`/mascot-preview.html` is a live review page. Pick a companion, choose an action and palette, and hover its label or any part of its row. Only the selected companion is working.

## Brand and app surfaces

`miles-mascot.svg`, `miles-logo.svg` and their animated variants use the same cream-and-blue CRT as the native app icon and favicon. Each standalone SVG embeds its bitmap so it does not depend on a remote image. Mascots inside the app remain unboxed; the native icon alone has the normal rounded Dock tile. `ComputerStatusIcon.svelte` carries that CRT into sleep, wake, connecting, waiting and disconnected computer screens, keeping the agent's accent. The status icon is 40px, with a responsive 28–40px size inside the live-screen placeholder. Waking adds an opacity reveal and in-screen progress without moving the casing; the icon disappears when the live desktop arrives. Sleep and error indicators remain still.

Grok Bot's installed dark theme uses neutral colors `#0e0e0e` (sidebar), `#121212` (chrome), `#161616` (pane) and `#1f1f1f` (elevated controls). Miles uses `#0e0e0e` for both side panels and `#161616` for the center, with `#1f1f1f` inputs. Both side-panel widths can be adjusted by dragging their grips or using arrow keys; Home and End move to the limits. Widths persist locally. Small text starts at 12px, and chat text is 15px.


## Chat and icons

`AppIcon.svelte` provides the complete interface icon set with one 24px grid, rounded line ends and a 1.75px stroke. Files use a simple folder/document, and memory uses a notebook. Decorative SVGs are hidden from accessibility trees; their buttons keep meaningful names and visible keyboard focus.

Grok Bot's chat UI was inspected through computer use, including its compact composer, expanded multiline layout, avatar-free message bubbles and Shift+Enter behavior. Miles now uses distinct user/assistant surfaces, visible sender labels and a thin, persistent agent-color separator.

The composer grows from one line to a bounded multiline field. Enter and Command/Control+Enter send, Shift+Enter inserts a line break, Command/Control+Shift+A attaches files, Command/Control+period stops a task, and Command/Control+K opens workspace search. Its shortcut help closes with Escape and restores focus. IME composition never submits a message. Native cursor, selection, Tab and Shift+Tab behavior remains intact. Duplicate sends are blocked, failed sends preserve the draft, and edits made while a message is pending are retained. The transcript can be focused for native keyboard scrolling.
