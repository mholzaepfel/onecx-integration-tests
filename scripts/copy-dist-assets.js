const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const distDir = path.join(root, 'dist')

function copyDirectory(sourceDir, targetDir) {
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Source directory does not exist: ${sourceDir}`)
  }

  fs.mkdirSync(targetDir, { recursive: true })

  for (const item of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, item.name)
    const targetPath = path.join(targetDir, item.name)

    if (item.isDirectory()) {
      copyDirectory(sourcePath, targetPath)
    } else if (item.isFile()) {
      fs.copyFileSync(sourcePath, targetPath)
    }
  }
}

function copyJsonFilesRecursively(sourceDir, targetDir) {
  if (!fs.existsSync(sourceDir)) {
    return
  }

  fs.mkdirSync(targetDir, { recursive: true })

  for (const item of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, item.name)
    const targetPath = path.join(targetDir, item.name)

    if (item.isDirectory()) {
      copyJsonFilesRecursively(sourcePath, targetPath)
    } else if (item.isFile() && item.name.endsWith('.json')) {
      fs.copyFileSync(sourcePath, targetPath)
    }
  }
}

const importsDir = path.join(root, 'imports')
const importsScriptsDir = path.join(root, 'imports-scripts')
const srcDir = path.join(root, 'src')
const distImportsDir = path.join(distDir, 'imports')
const distImportsScriptsDir = path.join(distDir, 'imports-scripts')

copyDirectory(importsDir, distImportsDir)
copyDirectory(importsScriptsDir, distImportsScriptsDir)

const assetsDir = path.join(root, 'assets')
const distAssetsDir = path.join(distDir, 'assets')
copyDirectory(assetsDir, distAssetsDir)

copyJsonFilesRecursively(srcDir, distDir)

const rootPackageJsonPath = path.join(root, 'package.json')
const rootPackageJson = JSON.parse(fs.readFileSync(rootPackageJsonPath, 'utf8'))

const distPackageJson = {
  name: rootPackageJson.name,
  version: rootPackageJson.version,
  license: rootPackageJson.license,
  repository: rootPackageJson.repository,
  main: rootPackageJson.main,
  types: rootPackageJson.types,
  exports: rootPackageJson.exports,
  bin: rootPackageJson.bin,
  peerDependencies: rootPackageJson.peerDependencies || {},
  publishConfig: rootPackageJson.publishConfig,
}

fs.writeFileSync(path.join(distDir, 'package.json'), JSON.stringify(distPackageJson, null, 2) + '\n')
console.log('Copied imports and generated dist/package.json')
