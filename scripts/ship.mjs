import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const verification = JSON.parse(readFileSync('.research/online-verification.json', 'utf8'))
if (!verification.ok) throw new Error('The native online test suite must pass before shipping. Run node scripts/verify-online.mjs first.')
function git(args) {
  const result = spawnSync('git', args, { encoding: 'utf8' })
  if (result.status !== 0) throw new Error(result.stderr || 'Git command failed')
  return result.stdout.trim()
}
if (git(['remote', 'get-url', 'origin']) !== 'https://github.com/Chenhuan-Tian/decisionroom.git') throw new Error('Unexpected origin; inspect the repository before publishing.')
if (git(['status', '--porcelain'])) throw new Error('Commit the reviewed changes before shipping.')
const branch = git(['branch', '--show-current'])
console.log(`Pushing ${branch} to the requested GitHub repository. Complete GitHub authentication yourself if prompted.`)
const push = spawnSync('git', ['push', '-u', 'origin', branch], { stdio: 'inherit' })
if (push.status !== 0) process.exit(push.status || 1)
console.log('Deploying to DeepSpace…')
const result = spawnSync(process.execPath, ['node_modules/deepspace/dist/cli.js', 'deploy', '--json'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
writeFileSync('.research/deploy.json', result.stdout || '')
writeFileSync('.research/deploy.log', result.stderr || '')
console.log(result.stdout || '')
if (result.status !== 0 || result.error) { console.error(result.stderr || result.error); process.exit(result.status || 1) }
for (const command of [['app', 'source'], ['releases']]) {
  const report = spawnSync(process.execPath, ['node_modules/deepspace/dist/cli.js', ...command, '--json'], { encoding: 'utf8' })
  writeFileSync(`.research/${command.join('-')}.json`, report.stdout || '')
}
console.log('Deployment response saved. Verify the returned live URL before submitting.')
