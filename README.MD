# Home — New Tab

When a user opens up their browser or opens a new tab, that space is a surface with high potential for a rich user experience. Traditionally the code driving that experience has been tightly integrated with the core Firefox code. While this has its benefits, ultimately it ties this dynamic surface to a release cadence out of sync with rapid iteration. To remedy this without sacrificing stability or privacy, we are splitting the core of this experience into three distinct parts.

- **API** — This is already distinct from the core newtab code, but it is important to call out here as it will be privy to the data contracts required to drive a rich experience.

- **Coordinator** — This is the foundation that will remain tightly coupled to the Firefox core. Its responsibilities are focused on being a privacy preserving data pipeline and a cache manager controlling render cycles. It maintains a record of the latest renderer stored in remote settings and updates it as needed without disrupting user flow with messy re-renders through a SWR (stale while revalidating) pattern.

- **Renderer** — This is the core user experience. It is uniquely separated here to allow for rapid iteration and experimentation that is not tied directly existing release cycles. The renderer will accept data from the coordinator, but it will be housed in remote settings, which will allow for continuous deployment. Keeping it as a discrete entity will mean we can cut semantic versions that are automatically deployed across the ecosystem.

Ultimately the goal here is to extricate ourselves from release cycle panic and prolonged time to insight. The coordinator maintains the current release cycle riding trains (or train hopping), and maintains stability and security. The renderer introduces rapid iteration and rapid deployment so we can learn fast and pivot quickly in service of creating top tier user experiences.

## Repository Structure

This repo is meant to run as a stand alone development environment. Traditional development meant building the entire Firefox codebase to iterate on the new tab. As the new tab is, for all intents and purposes, a web application built on standard JS technology, it makes more sense to leverage modern development techniques to speed up engineering time and improve developer experience. This will also allow for deeper cross team collaboration with more accessible representations of both the full experience and isolated components.

### Mono Repo

> A monorepo is a single repository containing multiple distinct projects, with well-defined relationships.
> — [monorepo.tools](https://monorepo.tools)

Since we have split up our mental model into data/coordinator/renderer, we want to make sure we are emulating that structure while developing. Entropy can quickly seep in the further away we get from structures used in production. Mono-repo gives us the ability to separate our concerns easily, while also provide some very nice quality of life improvements to our tooling. Being explicit with our dependencies, avoiding directory drilling and keeping code quality rules consistent, all while making development faster and easier to reason about.

### Familiarizing yourself with the Repo

There are distinct workspaces in the repo that are meant to provide some organization and clarity. Each workspace can house multiple namespaced projects.

#### Clients

This is where any stand alone user facing service/app lives. For the most part, these will be the final bundles and consumers of the discrete dependencies around the rest of the repo. Lots of notes here for this initial work in progress phase, so expect the adjustments here.

- **admin** _(EXPERIMENTAL)_ — a rough admin interface to experiment with unique signals coming from human intervention. In layman's terms, this was spun up so we could experiment with passing in priorities to influence layout. Doesn't have any effect on production and is not included in any bundling.
- **api** _(DEV ONLY)_ — a small local api that affords us the ability to proxy live data, serve mock data from an actual endpoint, and experiment with things like the admin. Doesn't have any effect on production and is not included in any bundling.
- **coordinator** — this represents the coordinator code. _NOTE: Still working through if we will be able to bundle from here, but most likely this will be more of a mirror of the coordinator that exists in the Firefox main code_
- **renderer** — the renderer that will be what we bundled and deployed to remote settings. _NOTE: at present this is very rudimentary to help people familiarize themselves with this pattern. It shows data that is pulled in from the coordinator as well as cache status for the renderer and the data. In future, this will be what houses the newtab surface_
- **web** — a roughed out version of the newtab experience. _NOTE: this will ultimately go away in favor of being housed in **renderer**, but for now it allows use to serve a local version of the whole surface_

#### Common

This is where general shared code lives. This should all be framework agnostic utility code and should not pull any dependencies in, so we avoid circular dependencies. These are included in many different projects in the repo by adding them to the package dependencies of the project and running an install.

- **types** (`"@common/types": "workspace:*"`) — shared types are helpful for creating a rich developer experience. Co-locating types is an alluring proposition, until it bites you with a circular dependency. Open to shifting this, but current experience has been that co-locating has long term challenges that outweigh the short term convenience.
- **utilities** (`"@common/utilities": "workspace:*"`) — these are agnostic utility functions that should be discrete and well tested helpers.

#### Config

All codebases eventually suffer from config bloat, making it hard to know what is required and what is just setup. This aims to clean that up a bit and allow us to have some consistent config that we don't have to repeat over and over again. At the same time, we can also make things extensible in the event that any given workspace has unique requirements.

- **asset-config** (`"@config/asset-config: "workspace:*"`) — This is a small utility to pull in assets from Firefox core. Primarily this is so we don't drift as UI changes are implemented, while at the same time being able to represent production assets. Check the asset-sync [README](config/asset-config/README.MD) for usage.
- **eslint-config** (`"@config/eslint-config: "workspace:*"`) — These are the config files for eslint. We still need to install eslint in the specific workspace we are linting, but we pull in these config files to keep things consistent across the repo.
- **generator-config** — Generators let us build rapidly with consistency and fidelity. These are the configs are for turbogen, but they are accessed directly from a root action: `pnpm gen` It won't be installed like some of the other configs. More on this later.
- **storybook-config** — This sets up storybooks with co-located stories without needing to spread config files all about the repo. Similar to the generators, these are a pseudo-app that doesn't get installed, but is triggered from a root action. `pnpm storybook`
- **stylelint-config** (`"@config/stylelint-config: "workspace:*"`) — Styles deserve linting too. As much as we can automate away innocuous but subjective opinions, the better. This helps css files have consistent styling and order.
- **typescript-config** (`"@config/typescript-config: "workspace:*"`) — Typescript brings delight to the developer experience (trust me on this one) and keeps code quality high. Bringing explicit intent to all the things.

#### Data

The primary reason for this workspace is to corral data manipulation and business logic into a single location. This is a prime vector for entropy in a codebase. It is simple and easy to make data manipulations inline, but these short term conveniences lead to long term headaches. Keeping data as its own workspace helps to keep component logic simple and focused.

- **mocks** (`"@data/mocks"`) — When we need to pull in static data for consistency in testing or storybooks, this is the spot to do it. Keeping it co-located with actual state helps to align reasoning
- **state** (`"@data/state"`) — This is Zustand state and custom hooks to allow storage and manipulation of data. This could easily be any state management framework, or even no framework at all. It simply gives us a central location for business logic.

#### UI

This is where we keep our isolated UI components and styles. Keeping things isolated from data means we have consistent UI that we can develop and view in isolation.

- **components** (`"@ui/components"`) — This is where most of the magic happens and will be the primary dev space for iteration and experimentation. Each of these isolated components will be used to build an integrated experience. These leverage css modules for clean isolation and are all backed by storybooks, unit tests and snapshot tests for high fidelity.
- **styles** (`"@ui/styles"`) — These are global baseline styles and variables for use within components and app integrations

## Getting Started

### Dependencies

- Node
- `pnpm` as the package manager
- Vite as the bundler (for now) / Vitest
- Storybooks
- React as the render engine (not a hard requirement)
- Zustand as state management
- TurboRepo as a mono-repo manager
- CSS Modules with postcss
- Typescript
- Eslint
- Stylelint

### Assumptions

- node (.nvm has a version)
- pnpm
  - `npm install --global corepack@latest`
  - `corepack enable pnpm`
  - `pnpm install` from the root

### Launching

After you are all set up a few final things are required:

- Set up .env files
  - there is a root `.env.example`. This houses ports for vite to use. Make a copy of it named simply: `.env`
  - `clients/api` also has a `.env.example`. Copy to `.env` and then enter the endpoint for discover data (ask a teammate or connect to a proxy)

- Sync assets — from root `pnpm sync-assets`

- Run dev — from root `pnpm dev`
  - this will start up the client services on the ports you added to the root `.env`
  - you can navigate them with the arrow keys and load them into a browser
  - most everything is hot-reloaded

- Run storybooks — from root `pnpm storybook`

## Help

It's the wild west here, and nothing set in stone. Just trying to account for eventualities and sort out the patterns and contracts.
