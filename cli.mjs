#!/usr/bin/env node
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dispatchOfficialSkillCli, runIntakeHandshake } from './installer.mjs'

await dispatchOfficialSkillCli({
  packageRoot: dirname(fileURLToPath(import.meta.url)),
  runCommand: (context) => runIntakeHandshake(context, {
    questions: [{
      id: 'interaction',
      prompt: 'Which user decision should be converted into a structured confirmation?',
      required: true,
      example: 'Confirm the approved document output path.',
    }],
    outputFile: 'CONFIRM-PROTOCOL-REQUIREMENTS.json',
  }),
})
