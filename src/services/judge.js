import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// This local runner is for trusted development input, not a security sandbox.
const run = (command, args, cwd, input = '', timeout = 3000) => new Promise(resolve => {
  const child = spawn(command, args, { cwd, detached: process.platform !== 'win32', env: { PATH: process.env.PATH, HOME: cwd, TMPDIR: cwd, LANG: 'C.UTF-8' }, stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '', stderr = '', settled = false;
  const kill = () => { try { if (process.platform !== 'win32') process.kill(-child.pid, 'SIGKILL'); else child.kill('SIGKILL'); } catch {} };
  const finish = result => { if (settled) return; settled = true; clearTimeout(timer); kill(); resolve(result); };
  const timer = setTimeout(() => finish({ status: 'TLE', output: 'Time Limit Exceeded' }), timeout);
  const capture = (data, error) => {
    if (error) stderr += data.toString(); else stdout += data.toString();
    if (stdout.length + stderr.length > 256 * 1024) finish({ status: 'Runtime Error', output: 'Output limit exceeded' });
  };
  child.stdout.on('data', data => capture(data, false));
  child.stderr.on('data', data => capture(data, true));
  child.on('error', error => finish({ status: 'Unavailable', output: error.code === 'ENOENT' ? 'Required compiler or runtime is not installed' : 'Unable to start runtime' }));
  child.on('close', code => finish({ status: code === 0 ? 'OK' : 'Runtime Error', output: code === 0 ? stdout : stderr || 'Program exited unsuccessfully' }));
  child.stdin.on('error', () => {});
  child.stdin.end(input);
});

export const executeSubmission = async (code, language, testCases, boilerplate = '') => {
  if (typeof code !== 'string' || !code.trim() || code.length > 100000 || !Array.isArray(testCases) || !testCases.length) return { success: false, error: 'Code and at least one test case are required' };
  const runtimes = {
    javascript: { file: 'solution.mjs', command: process.execPath, args: ['solution.mjs'] },
    python: { file: 'solution.py', command: 'python3', args: ['solution.py'] },
    cpp: { file: 'solution.cpp', compile: ['g++', ['-O2', 'solution.cpp', '-o', 'solution']], command: './solution', args: [] },
    java: { file: 'Solution.java', compile: ['javac', ['Solution.java']], command: 'java', args: ['-Xmx128m', '-cp', '.', 'Solution'] },
  };
  const runtime = runtimes[language];
  if (!runtime) return { success: false, error: 'Unsupported language' };
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'codearena-'));
  try {
    await fs.writeFile(path.join(directory, runtime.file), boilerplate ? code + '\n' + boilerplate : code);
    if (runtime.compile) {
      const compiled = await run(runtime.compile[0], runtime.compile[1], directory, '', 15000);
      if (compiled.status === 'Unavailable') return { success: false, error: compiled.output };
      if (compiled.status !== 'OK') return { success: true, status: 'Compilation Error', error: compiled.output, passedCount: 0, totalCount: testCases.length, results: [] };
    }
    const results = [];
    for (const testCase of testCases) {
      const result = await run(runtime.command, runtime.args, directory, String(testCase.input ?? ''));
      if (result.status === 'Unavailable') return { success: false, error: result.output };
      const expected = String(testCase.expectedOutput ?? '').trim().replace(/\r/g, '');
      const output = result.output.trim().replace(/\r/g, '');
      const status = result.status === 'OK' ? output === expected ? 'Accepted' : 'Wrong Answer' : result.status;
      results.push({ input: testCase.input, expectedOutput: testCase.expectedOutput, output, status, isCorrect: status === 'Accepted' });
    }
    return { success: true, status: results.find(result => !result.isCorrect)?.status || 'Accepted', passedCount: results.filter(result => result.isCorrect).length, totalCount: results.length, results };
  } catch (error) {
    return { success: false, error: error.message };
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
};
