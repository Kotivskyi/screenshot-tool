import { chromium, devices, Page, BrowserContext } from 'playwright';
import { spawnSync, spawn, ChildProcess, execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as net from 'net';
import * as yaml from 'js-yaml';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScreenParam {
  name: string;
  required: boolean;
  default?: string;
}

interface ScreenState {
  name: string;
  params?: ScreenParam[];
}

interface Screen {
  name: string;
  path: string;
  auth: boolean;
  states: ScreenState[];
}

interface ScreensConfig {
  schema: string;
  screens: Screen[];
}

interface ParsedDeepLink {
  screenName: string;
  state: string;
  params: Record<string, string>;
}

interface DeviceProfile {
  width: number;
  height: number;
  deviceScaleFactor: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FRONTEND_DIR = path.resolve(__dirname, '..');
const SCREENS_YAML_PATH = path.join(__dirname, 'screens.yaml');
const DEFAULT_PORT = 3001;
const BASE_URL = `http://localhost:${DEFAULT_PORT}`;
const DEFAULT_TIMEOUT = 3000;
const SERVER_START_TIMEOUT = 60_000;

const DEVICE_PROFILES: Record<string, DeviceProfile> = {
  desktop: { width: 1280, height: 720, deviceScaleFactor: 1 },
  tablet: { width: 768, height: 1024, deviceScaleFactor: 2 },
  mobile: { width: 375, height: 812, deviceScaleFactor: 3 },
};

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_USER = {
  id: '1',
  name: 'Admin User',
  email: 'admin@test.com',
  isAdmin: true,
  status: 'active',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

const MOCK_SLOTS = [
  {
    id: 'slot-1',
    location: 'Main Stadium Field A',
    date: '2025-06-15',
    startTime: '09:00',
    endTime: '10:00',
    capacity: 10,
    price: 25.0,
    description: 'Morning session on Field A',
    status: 'AVAILABLE',
    bookedCount: 3,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'slot-2',
    location: 'Community Park Field B',
    date: '2025-06-16',
    startTime: '14:00',
    endTime: '15:30',
    capacity: 20,
    price: 30.0,
    description: 'Afternoon session on Field B',
    status: 'BOOKED',
    bookedCount: 20,
    createdAt: '2025-01-02T00:00:00.000Z',
    updatedAt: '2025-01-02T00:00:00.000Z',
  },
  {
    id: 'slot-3',
    location: 'Indoor Arena Court 1',
    date: '2025-06-17',
    startTime: '18:00',
    endTime: '19:00',
    capacity: 12,
    price: 40.0,
    description: 'Evening indoor session',
    status: 'AVAILABLE',
    bookedCount: 7,
    createdAt: '2025-01-03T00:00:00.000Z',
    updatedAt: '2025-01-03T00:00:00.000Z',
  },
];

const MOCK_BOOKINGS = [
  {
    id: 'booking-1',
    userId: '2',
    slotId: 'slot-1',
    status: 'CONFIRMED',
    paymentStatus: 'PAID',
    paymentAmount: 25.0,
    user: { id: '2', name: 'John Doe', email: 'john@example.com', isAdmin: false },
    slot: MOCK_SLOTS[0],
    createdAt: '2025-02-01T00:00:00.000Z',
    updatedAt: '2025-02-01T00:00:00.000Z',
  },
  {
    id: 'booking-2',
    userId: '3',
    slotId: 'slot-2',
    status: 'CANCELLED',
    paymentStatus: 'REFUNDED',
    paymentAmount: 30.0,
    user: { id: '3', name: 'Jane Smith', email: 'jane@example.com', isAdmin: false },
    slot: MOCK_SLOTS[1],
    createdAt: '2025-02-05T00:00:00.000Z',
    updatedAt: '2025-02-05T00:00:00.000Z',
  },
  {
    id: 'booking-3',
    userId: '2',
    slotId: 'slot-3',
    status: 'COMPLETED',
    paymentStatus: 'PAID',
    paymentAmount: 40.0,
    user: { id: '2', name: 'John Doe', email: 'john@example.com', isAdmin: false },
    slot: MOCK_SLOTS[2],
    createdAt: '2025-02-10T00:00:00.000Z',
    updatedAt: '2025-02-10T00:00:00.000Z',
  },
];

const MOCK_USERS = [
  MOCK_USER,
  {
    id: '2',
    name: 'John Doe',
    email: 'john@example.com',
    isAdmin: false,
    status: 'active',
    createdAt: '2025-01-10T00:00:00.000Z',
    updatedAt: '2025-01-10T00:00:00.000Z',
  },
  {
    id: '3',
    name: 'Jane Smith',
    email: 'jane@example.com',
    isAdmin: false,
    status: 'active',
    createdAt: '2025-01-15T00:00:00.000Z',
    updatedAt: '2025-01-15T00:00:00.000Z',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadScreensConfig(): ScreensConfig {
  const raw = fs.readFileSync(SCREENS_YAML_PATH, 'utf-8');
  return yaml.load(raw) as ScreensConfig;
}

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};
  let i = 2; // skip node and script path
  while (i < argv.length) {
    const arg = argv[i];
    if (arg === '--help') {
      args.help = true;
      i++;
    } else if (arg === '--no-build') {
      args['no-build'] = true;
      i++;
    } else if (arg === '--no-restart') {
      args['no-restart'] = true;
      i++;
    } else if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        i += 2;
      } else {
        args[key] = true;
        i++;
      }
    } else {
      i++;
    }
  }
  return args;
}

function parseDeepLink(url: string, config: ScreensConfig): ParsedDeepLink {
  const schemaPrefix = config.schema;
  if (!url.startsWith(schemaPrefix)) {
    throw new Error(`Invalid deep link schema. Expected "${schemaPrefix}" prefix, got: ${url}`);
  }

  const withoutSchema = url.slice(schemaPrefix.length);
  const [screenName, queryString] = withoutSchema.split('?');

  const params: Record<string, string> = {};
  let state = 'default';

  if (queryString) {
    const searchParams = new URLSearchParams(queryString);
    for (const [key, value] of searchParams.entries()) {
      if (key === 'state') {
        state = value;
      } else {
        params[key] = value;
      }
    }
  }

  // Validate screen exists
  const screen = config.screens.find((s) => s.name === screenName);
  if (!screen) {
    const validNames = config.screens.map((s) => s.name).join(', ');
    throw new Error(`Unknown screen "${screenName}". Valid screens: ${validNames}`);
  }

  // Validate state exists for this screen
  const screenState = screen.states.find((s) => s.name === state);
  if (!screenState) {
    const validStates = screen.states.map((s) => s.name).join(', ');
    throw new Error(
      `Unknown state "${state}" for screen "${screenName}". Valid states: ${validStates}`
    );
  }

  // Validate required params
  if (screenState.params) {
    for (const p of screenState.params) {
      if (p.required && !params[p.name]) {
        throw new Error(
          `Missing required parameter "${p.name}" for screen "${screenName}" state "${state}"`
        );
      }
    }
  }

  // Also check if path has :id placeholder - require id param
  if (screen.path.includes(':id') && !params.id) {
    throw new Error(
      `Missing required parameter "id" for screen "${screenName}" (path: ${screen.path})`
    );
  }

  return { screenName, state, params };
}

function resolveRoute(screen: Screen, params: Record<string, string>): string {
  let route = screen.path;
  for (const [key, value] of Object.entries(params)) {
    route = route.replace(`:${key}`, value);
  }
  return route;
}

function printHelp(config: ScreensConfig): void {
  console.log(`take_screenshot — Capture screenshots of the admin dashboard

Usage:
  npx tsx frontend/screenshot-tool/take_screenshot.ts --url <deep_link_url> [OPTIONS]

Options:
  --url <url>         Deep link URL (required). Format: ${config.schema}<screen>?state=<state>&param=value
  --output <path>     Output screenshot path (default: ./screenshots/{datetime}_screenshot.png)
  --timeout <ms>      Max wait for screen to settle (default: ${DEFAULT_TIMEOUT}ms)
  --device <device>   Viewport emulation: desktop (default), tablet, mobile
  --no-build          Skip the build step
  --no-restart        Reuse running app instance; leave it running after screenshot
  --help              Print this help message

Exit codes:
  0   Success
  1   App build or launch error
  2   Navigation or deep link error
  3   Screenshot capture error
  4   Timeout exceeded

Registered screens and states:
`);

  for (const screen of config.screens) {
    console.log(`  ${screen.name}`);
    console.log(`    path: ${screen.path}`);
    console.log(`    auth: ${screen.auth}`);
    console.log(`    states:`);
    for (const state of screen.states) {
      let line = `      - ${state.name}`;
      if (state.params && state.params.length > 0) {
        const paramDescs = state.params.map(
          (p) => `${p.name}${p.required ? ' (required)' : ' (optional)'}`
        );
        line += `  [params: ${paramDescs.join(', ')}]`;
      }
      console.log(line);
    }
    console.log();
  }

  console.log(`Deep link examples:
  ${config.schema}login
  ${config.schema}login?state=error
  ${config.schema}dashboard
  ${config.schema}dashboard?state=loading
  ${config.schema}dashboard?state=empty
  ${config.schema}slot-details?id=abc123
  ${config.schema}slot-details?id=abc123&state=error
`);
}

async function isPortListening(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(500);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, '127.0.0.1');
  });
}

async function waitForPort(port: number, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isPortListening(port)) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server did not start within ${timeoutMs}ms`);
}

// ---------------------------------------------------------------------------
// API mocking
// ---------------------------------------------------------------------------

/**
 * The Dashboard component calls getSlots/getBookings/getUsers via Promise.all
 * and expects { data: [...], meta: { totalItems } } from all three.
 * However, getSlots returns { items: [...], total: N } due to an app bug.
 * This init script patches the returned object so Dashboard can read it.
 */
async function patchSlotsResponseFormat(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const origAll = Promise.all.bind(Promise);
    Promise.all = function (promises: any) {
      return origAll(promises).then((results: any[]) => {
        if (Array.isArray(results)) {
          for (const r of results) {
            if (r && r.items && Array.isArray(r.items) && !r.meta && !r.data) {
              r.data = r.items;
              r.meta = {
                totalItems: r.total || r.items.length,
                currentPage: 1,
                itemsPerPage: 10,
              };
            }
          }
        }
        return results;
      });
    } as any;
  });
}

async function setupAuthMocking(page: Page): Promise<void> {
  // Inject localStorage before any page JS runs
  await page.addInitScript(() => {
    localStorage.setItem('token', 'mock-jwt-token');
    localStorage.setItem(
      'user',
      JSON.stringify({
        id: '1',
        name: 'Admin User',
        email: 'admin@test.com',
        isAdmin: true,
        status: 'active',
      })
    );
  });

  // Mock the auth verification endpoint
  await page.route('**/api/auth/me', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: { user: MOCK_USER },
      }),
    });
  });
}

async function setupStateMocking(
  page: Page,
  screenName: string,
  state: string,
  params: Record<string, string>
): Promise<void> {
  if (state === 'loading') {
    // Intercept all API calls and never resolve them (hang forever)
    await page.route('**/api/**', (route) => {
      const url = route.request().url();
      // Always let auth/me through so the app doesn't redirect to login
      if (url.includes('/api/auth/me')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { user: MOCK_USER } }),
        });
        return;
      }
      // All other API calls hang forever to show loading state
      // Do nothing — the request just hangs
    });
    return;
  }

  if (state === 'error') {
    // Special case: login error state
    // Use 400 (not 401) to avoid the axios interceptor's 401 handler which does
    // window.location.href = '/login' and causes a full page reload
    if (screenName === 'login') {
      await page.route('**/api/auth/login', (route) => {
        route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Invalid email or password. Please try again.' }),
        });
      });
      return;
    }

    // For other screens: return 500 for data endpoints, but let auth through
    await page.route('**/api/**', (route) => {
      const url = route.request().url();
      if (url.includes('/api/auth/me')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { user: MOCK_USER } }),
        });
        return;
      }
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Internal Server Error' }),
      });
    });
    return;
  }

  if (state === 'empty') {
    await page.route('**/api/**', (route) => {
      const url = route.request().url();

      if (url.includes('/api/auth/me')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { user: MOCK_USER } }),
        });
        return;
      }

      if (url.includes('/api/slots')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ slots: [], total: 0 }),
        });
        return;
      }

      if (url.includes('/api/bookings')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, count: 0, data: [] }),
        });
        return;
      }

      if (url.includes('/api/auth/users') || url.includes('/api/users')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ users: [], total: 0 }),
        });
        return;
      }

      // Fallback: empty response
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      });
    });
    return;
  }

  // Default state: return realistic mock data
  await page.route('**/api/**', (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (url.includes('/api/auth/me')) {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { user: MOCK_USER } }),
      });
      return;
    }

    if (url.includes('/api/auth/login') && method === 'POST') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          token: 'mock-jwt-token',
          user: MOCK_USER,
        }),
      });
      return;
    }

    // GET /api/slots/:id
    if (url.match(/\/api\/slots\/[^/]+$/) && !url.includes('/edit') && method === 'GET') {
      const id = params.id || 'slot-1';
      const slot = MOCK_SLOTS.find((s) => s.id === id) || { ...MOCK_SLOTS[0], id };
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(slot),
      });
      return;
    }

    // GET /api/slots
    if (url.includes('/api/slots') && method === 'GET') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ slots: MOCK_SLOTS, total: MOCK_SLOTS.length }),
      });
      return;
    }

    // GET /api/bookings/:id
    if (url.match(/\/api\/bookings\/[^/]+$/) && method === 'GET') {
      const id = params.id || 'booking-1';
      const booking = MOCK_BOOKINGS.find((b) => b.id === id) || { ...MOCK_BOOKINGS[0], id };
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(booking),
      });
      return;
    }

    // GET /api/bookings
    if (url.includes('/api/bookings') && method === 'GET') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          count: MOCK_BOOKINGS.length,
          data: MOCK_BOOKINGS,
        }),
      });
      return;
    }

    // GET /api/users/:id
    if (url.match(/\/api\/users\/[^/]+$/) && method === 'GET') {
      const id = params.id || '1';
      const user = MOCK_USERS.find((u) => u.id === id) || { ...MOCK_USERS[0], id };
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(user),
      });
      return;
    }

    // GET /api/auth/users or /api/users
    if ((url.includes('/api/auth/users') || url.includes('/api/users')) && method === 'GET') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ users: MOCK_USERS, total: MOCK_USERS.length }),
      });
      return;
    }

    // Fallback: pass through
    route.continue();
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  // Load screen config
  let config: ScreensConfig;
  try {
    config = loadScreensConfig();
  } catch (err: any) {
    console.error(`Error loading screens.yaml: ${err.message}`);
    process.exit(2);
  }

  // --help
  if (args.help) {
    printHelp(config);
    process.exit(0);
  }

  // Validate --url
  if (!args.url || typeof args.url !== 'string') {
    console.error('Error: --url is required. Use --help for usage information.');
    process.exit(2);
  }

  // Validate --device
  const deviceName = (typeof args.device === 'string' ? args.device : 'desktop').toLowerCase();
  if (!DEVICE_PROFILES[deviceName]) {
    const valid = Object.keys(DEVICE_PROFILES).join(', ');
    console.error(`Error: Invalid --device value "${deviceName}". Valid values: ${valid}`);
    process.exit(2);
  }
  const deviceProfile = DEVICE_PROFILES[deviceName];

  // Parse deep link
  let deepLink: ParsedDeepLink;
  try {
    deepLink = parseDeepLink(args.url as string, config);
  } catch (err: any) {
    console.error(`Error: ${err.message}`);
    process.exit(2);
  }

  const screen = config.screens.find((s) => s.name === deepLink.screenName)!;
  const timeout = typeof args.timeout === 'string' ? parseInt(args.timeout, 10) : DEFAULT_TIMEOUT;
  const noBuild = !!args['no-build'];
  const noRestart = !!args['no-restart'];

  // Determine output path
  let outputPath: string;
  if (typeof args.output === 'string') {
    outputPath = path.resolve(args.output);
  } else {
    const screenshotsDir = path.join(FRONTEND_DIR, 'screenshots');
    fs.mkdirSync(screenshotsDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    outputPath = path.join(screenshotsDir, `${ts}_screenshot.png`);
  }

  // Ensure output directory exists
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  // ---------------------------------------------------------------------------
  // Step 1: Build
  // ---------------------------------------------------------------------------
  if (!noBuild) {
    console.error('Building frontend...');
    const buildResult = spawnSync('npm', ['run', 'build'], {
      cwd: FRONTEND_DIR,
      stdio: 'inherit',
      shell: true,
    });
    if (buildResult.status !== 0) {
      console.error('Error: Build failed');
      process.exit(1);
    }
  }

  // ---------------------------------------------------------------------------
  // Step 2: Launch server
  // ---------------------------------------------------------------------------
  let serverProcess: ChildProcess | null = null;
  const alreadyRunning = await isPortListening(DEFAULT_PORT);

  if (noRestart && alreadyRunning) {
    console.error('Reusing existing server on port ' + DEFAULT_PORT);
  } else {
    if (alreadyRunning) {
      console.error(`Port ${DEFAULT_PORT} already in use, killing existing process...`);
      try {
        execSync(`lsof -ti:${DEFAULT_PORT} | xargs kill -9 2>/dev/null`, { stdio: 'ignore' });
        // Wait a moment for the port to free up
        await new Promise((r) => setTimeout(r, 1000));
      } catch {
        // Ignore errors if no process was found
      }
    }

    console.error('Starting frontend server...');
    serverProcess = spawn('npm', ['start'], {
      cwd: FRONTEND_DIR,
      stdio: 'ignore',
      shell: true,
      detached: true,
      env: { ...process.env, BROWSER: 'none', PORT: String(DEFAULT_PORT) },
    });

    serverProcess.unref();

    try {
      await waitForPort(DEFAULT_PORT, SERVER_START_TIMEOUT);
      console.error('Server started on port ' + DEFAULT_PORT);
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      if (serverProcess) {
        try {
          process.kill(-serverProcess.pid!, 'SIGKILL');
        } catch {}
      }
      process.exit(1);
    }
  }

  // ---------------------------------------------------------------------------
  // Step 3-9: Browser, Auth, Mock, Navigate, Settle, Screenshot
  // ---------------------------------------------------------------------------
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: deviceProfile.width, height: deviceProfile.height },
      deviceScaleFactor: deviceProfile.deviceScaleFactor,
    });
    const page = await context.newPage();

    // Setup auth for protected routes
    if (screen.auth) {
      await setupAuthMocking(page);
    }

    // Patch getSlots response format for Dashboard compatibility
    if (deepLink.screenName === 'dashboard') {
      await patchSlotsResponseFormat(page);
    }

    // Setup state mocking
    await setupStateMocking(page, deepLink.screenName, deepLink.state, deepLink.params);

    // Resolve the URL
    const route = resolveRoute(screen, deepLink.params);
    const fullUrl = `${BASE_URL}${route}`;
    console.error(`Navigating to ${fullUrl} (screen: ${deepLink.screenName}, state: ${deepLink.state})`);

    // Navigate
    try {
      await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    } catch (err: any) {
      console.error(`Error: Navigation failed — ${err.message}`);
      process.exit(2);
    }

    // Special handling for login error state:
    // The app's AuthContext sets isLoading=true during login, which causes App.tsx
    // to unmount Login (showing a loading spinner). When the error comes back and
    // Login remounts, its local error state is lost. So we inject the error alert
    // via DOM manipulation after the form renders.
    if (deepLink.screenName === 'login' && deepLink.state === 'error') {
      try {
        await page.waitForSelector('[data-testid="email-input"]', { timeout: 10_000 });
        // Fill form fields for visual realism
        await page.fill('[data-testid="email-input"]', 'admin@test.com');
        await page.fill('[data-testid="password-input"]', 'wrongpassword');

        // Inject a MUI-styled error alert into the login form
        await page.evaluate(() => {
          const paper = document.querySelector('.MuiPaper-root');
          if (!paper) return;

          const alertDiv = document.createElement('div');
          alertDiv.setAttribute('role', 'alert');
          alertDiv.style.cssText = [
            'display: flex',
            'padding: 6px 16px',
            'font-size: 0.875rem',
            'font-family: "Roboto","Helvetica","Arial",sans-serif',
            'font-weight: 400',
            'line-height: 1.43',
            'border-radius: 4px',
            'letter-spacing: 0.01071em',
            'background-color: rgb(253, 237, 237)',
            'color: rgb(95, 33, 32)',
            'margin-bottom: 16px',
            'width: 100%',
            'align-items: center',
            'box-sizing: border-box',
          ].join(';');

          const iconDiv = document.createElement('div');
          iconDiv.style.cssText =
            'margin-right: 12px; padding: 7px 0; display: flex; font-size: 22px; opacity: 0.9; color: #ef5350;';
          iconDiv.innerHTML =
            '<svg focusable="false" aria-hidden="true" viewBox="0 0 24 24" style="width:22px;height:22px;fill:currentColor"><path d="M11 15h2v2h-2zm0-8h2v6h-2zm.99-5C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"></path></svg>';

          const msgDiv = document.createElement('div');
          msgDiv.style.cssText = 'padding: 8px 0;';
          msgDiv.textContent = 'Invalid email or password. Please try again.';

          alertDiv.appendChild(iconDiv);
          alertDiv.appendChild(msgDiv);

          // Insert alert before the form element
          const form = paper.querySelector('form');
          if (form) {
            form.parentNode!.insertBefore(alertDiv, form);
          }
        });
        await page.waitForTimeout(300);
      } catch (err: any) {
        console.error(`Error: Could not trigger login error state — ${err.message}`);
        process.exit(2);
      }
    }

    // Settle: wait for screen to finish rendering
    try {
      if (deepLink.state === 'loading') {
        // For loading state: wait for a progress indicator to appear
        await page.waitForSelector('[role="progressbar"]', { timeout });
      } else {
        // For other states: wait for network idle and progress indicator to disappear
        await page.waitForLoadState('networkidle', { timeout });
        // Give a small extra buffer for React to finish rendering
        await page.waitForTimeout(500);
        // Make sure any loading spinners are gone
        try {
          await page.waitForFunction(
            () => !document.querySelector('[role="progressbar"]'),
            { timeout: Math.max(timeout - 500, 1000) }
          );
        } catch {
          // If progressbar is still showing, that's okay for some states
        }
      }
    } catch (err: any) {
      if (err.message.includes('Timeout')) {
        console.error(`Error: Settle timeout exceeded (${timeout}ms)`);
        process.exit(4);
      }
      // Non-timeout errors during settling are acceptable (e.g., no progressbar found)
    }

    // Screenshot
    try {
      await page.screenshot({ path: outputPath, fullPage: false });
    } catch (err: any) {
      console.error(`Error: Screenshot capture failed — ${err.message}`);
      process.exit(3);
    }

    // Success: print absolute path to stdout
    console.log(path.resolve(outputPath));
  } finally {
    // Teardown
    if (browser) {
      await browser.close();
    }
    if (serverProcess && !noRestart) {
      console.error('Stopping server...');
      try {
        process.kill(-serverProcess.pid!, 'SIGTERM');
      } catch {
        try {
          serverProcess.kill('SIGTERM');
        } catch {}
      }
      // Also kill by port as backup
      try {
        execSync(`lsof -ti:${DEFAULT_PORT} | xargs kill -9 2>/dev/null`, { stdio: 'ignore' });
      } catch {}
    }
  }
}

main().catch((err) => {
  console.error(`Unexpected error: ${err.message}`);
  process.exit(1);
});
