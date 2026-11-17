import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'

// Run from a normal, network-enabled terminal. Test-account passwords pass only
// through stdin; the DeepSpace CLI owns their storage. Never print credentials.
const cli = 'node_modules/deepspace/dist/cli.js'
const label = `decisionroom-${Date.now()}`
const env = { ...process.env, DR_TEST_LABEL: label }
function run(args, options = {}) {
  const result = spawnSync(process.execPath, args, { env, encoding: 'utf8', ...options })
  if (result.error || result.status !== 0) throw new Error(options.stdio === 'inherit' ? `Command failed: ${args.slice(0, 4).join(' ')}` : result.stderr || result.stdout || 'Command failed')
  return result.stdout
}
mkdirSync('.research', { recursive: true })
run([cli, 'auth', 'whoami', '--json'])
for (const role of ['Host', 'Guest', 'Outsider']) {
  const password = randomBytes(24).toString('base64url') + 'aA9!'
  run([cli, 'test', 'accounts', 'create', '--email', `${role.toLowerCase()}-${Date.now()}@deepspace.test`, '--name', `DR ${role}`, '--label', label, '--password-stdin', '--json'], { input: password + '\n' })
  console.log(`Provisioned isolated ${role.toLowerCase()} test account.`)
}
console.log('Running SDK smoke, API, and three-user product tests on a separate port (5182). No paid integration calls or Calendar writes.')
const result = spawnSync(process.execPath, [cli, 'test', 'run', 'all', '--port', '5182'], { env, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
writeFileSync('.research/online-verification.txt', [result.stdout || '', result.stderr || ''].join('\n'))
writeFileSync('.research/online-verification.json', JSON.stringify({ ok: result.status === 0 && !result.error, label, finishedAt: new Date().toISOString() }, null, 2))
console.log(result.stdout || '')
console.error(result.stderr || '')
if (result.error || result.status !== 0) process.exit(1)
console.log('Verification passed. Full report: .research/online-verification.txt')
