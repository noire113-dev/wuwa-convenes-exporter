const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')
for (const rollback of [false, true]) {
  test(`Windows installer ${rollback ? 'rolls back failed launch' : 'preserves records and settings'}`, { skip: process.platform !== 'win32' }, () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wuwa-helper-test-'))
    try {
      const target = path.join(root, 'app with spaces')
      const stage = path.join(root, '.wuwa-update-test')
      const backup = target + '.backup-test'
      const exe = 'WuWa Convenes Exporter.exe'
      fs.mkdirSync(path.join(target, 'userData'), { recursive: true })
      fs.mkdirSync(stage)
      fs.writeFileSync(path.join(target, exe), 'old')
      fs.writeFileSync(path.join(stage, exe), 'new')
      fs.writeFileSync(path.join(target, 'userData', 'record.json'), '{"saved":true}')
      const configFile = path.join(root, 'config.json')
      fs.writeFileSync(configFile, JSON.stringify({ target, stage, backup, exe, pid: 2147483647 }))
      // Stub process launch and the failure dialog only; exercise real filesystem swaps.
      let script = fs.readFileSync(path.join(__dirname, '../src/updater.ps1'), 'utf8')
      script = script.replace("$ErrorActionPreference = 'Stop'", `$ErrorActionPreference = 'Stop'\n$script:launches = 0\nfunction Start-Process { $script:launches++; if (${rollback ? '$true' : '$false'} -and $script:launches -eq 1) { throw 'Simulated launch failure' } }`)
      script = script.replace('  Add-Type -AssemblyName System.Windows.Forms', '')
      script = script.replace(/^  \[System.Windows.Forms.MessageBox\].*$/m, '  Write-Output $problem')
      const helper = path.join(root, 'helper.ps1')
      fs.writeFileSync(helper, script)
      const result = spawnSync(path.join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe'), ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', helper, '-Mode', 'Apply', '-ConfigFile', configFile], { encoding: 'utf8', windowsHide: true, timeout: 20000 })
      assert.equal(result.status, rollback ? 1 : 0, result.stderr)
      assert.equal(fs.readFileSync(path.join(target, exe), 'utf8'), rollback ? 'old' : 'new')
      assert.equal(fs.readFileSync(path.join(target, 'userData/record.json'), 'utf8'), '{"saved":true}')
      if (!rollback) assert.equal(fs.readFileSync(path.join(backup, exe), 'utf8'), 'old')
    } finally { fs.rmSync(root, { recursive: true, force: true }) }
  })
}
