#!/usr/bin/env node

const { execSync } = require('node:child_process')

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

function main() {
    const { bump, publishArgs } = parseArgs(process.argv.slice(2))

    console.log(`[release] Starting release with version bump: ${bump}`)
    console.log('[release] Step 1/4: clean build artifacts')
    runCommand('rm -rf dist')

    console.log('[release] Step 2/4: increment package version')
    runCommand(`npm version ${bump} --no-git-tag-version`)

    console.log('[release] Step 3/4: build package artifacts')
    runCommand('npm run build:package')

    const extraPublishArgs = publishArgs.join(' ').trim()
    const publishCommand = extraPublishArgs
        ? `npm publish ./dist ${extraPublishArgs}`
        : 'npm publish ./dist'

    console.log('[release] Step 4/4: publish package to npm')
    runCommand(publishCommand)

    console.log('[release] Release completed successfully')
}

main()
