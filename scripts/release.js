#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { execSync } = require('node:child_process')

const root = path.resolve(__dirname, '..')

const VALID_BUMPS = new Set([
    'patch',
    'minor',
    'major',
])

function runCommand(command) {
    execSync(command, { stdio: 'inherit' })
}

function parseArgs(argv) {
    let bump = 'patch'
    const publishArgs = []

    for (const arg of argv) {
        if (VALID_BUMPS.has(arg)) {
            bump = arg
            continue
        }

        publishArgs.push(arg)
    }

    return { bump, publishArgs }
}

function persistRelease(version) {
    runCommand('git config user.name "github-actions[bot]"')
    runCommand('git config user.email "41898282+github-actions[bot]@users.noreply.github.com"')
    runCommand('git add package.json package-lock.json')

    // Guard against an empty commit (e.g. a re-run where nothing changed).
    const status = execSync('git status --porcelain', { encoding: 'utf8' })
    if (!status.trim()) {
        console.log('[release] No version change to commit — skipping commit/tag/push')
        return
    }

    runCommand(`git commit -m "chore(release): v${version}"`)
    runCommand(`git tag v${version}`)
    runCommand('git push origin HEAD')
    runCommand(`git push origin v${version}`)
}

function main() {
    const { bump, publishArgs } = parseArgs(process.argv.slice(2))

    console.log(`[release] Starting release with version bump: ${bump}`)
    console.log('[release] Step 1/5: clean build artifacts')
    runCommand('rm -rf dist')

    console.log('[release] Step 2/5: increment package version')
    runCommand(`npm version ${bump} --no-git-tag-version`)

    console.log('[release] Step 3/5: build package artifacts')
    runCommand('npm run build:package')

    const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version

    const extraPublishArgs = publishArgs.join(' ').trim()
    const publishCommand = extraPublishArgs
        ? `npm publish ./dist ${extraPublishArgs}`
        : 'npm publish ./dist'

    console.log('[release] Step 4/5: publish package to npm')
    runCommand(publishCommand)

    console.log('[release] Step 5/5: commit version bump, tag and push')
    persistRelease(version)

    console.log(`[release] Release completed successfully at v${version}`)
}

main()
