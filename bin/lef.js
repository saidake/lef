'use strict';

const download = require('download-git-repo');
const envinfo = require('envinfo');
const chalk = require('chalk');
const path = require('path');
const os = require('os');
const spawn = require('cross-spawn');
const { tspath, originalpath } = require('../config/config');
const ora = require('ora');
const packageJson = require('../package.json');
const commander = require('commander');
const fs = require('fs');
const spinner = ora('creating');

// other package
const https = require('https');
// const dns = require('dns');
const execSync = require('child_process').execSync;
const hyperquest = require('hyperquest');
const prompts = require('prompts');
const semver = require('semver');
const tmp = require('tmp');
const unpack = require('tar-pack').unpack;
const url = require('url');
const validateProjectName = require('validate-npm-package-name');

// const packageJson = require('./package.json');


spinner.color = 'yellow';
spinner.text = 'Loading rainbows';

const program = new commander.Command(packageJson.name);
let projectName, appName, isTypeScript=false;

program
  .version(packageJson.version, '-v,--version', 'print version number')
  .arguments('[project-name]')
  .usage('<project-name> [options]')
  .action((name) => {
    projectName = name;
  })
  .allowUnknownOption()
  .description('this command can help you to create a simple project')
  .option('-o,--info', 'print package info')
  .option('-e,--env', 'print your environment info')
  .option('-t,--typescript', 'create typescript project')
  .on('--help', () => {
    console.log();
    console.log(`Only ${chalk.cyanBright('<project-name>')} is required.`);
    console.log(
      `the git homepage help you to start: ${chalk.white(
        `${packageJson.homepage}`
      )}`
    );
  })
  .on('option:info', () => {
    console.log(
      `\n  current version of ${packageJson.name}: ${packageJson.version}`
    );
    process.exit(1);
  })
  .on('option:env', () => {
    console.log(chalk.cyan(`\n current runtime:  ${os.cpus()[0].model}`));
    process.exit(1);
  })
  .on('option:typescript', () => {
    isTypeScript=true;
  })
  .parse(process.argv);


//check project name
if (typeof projectName === 'undefined') {
  console.log(chalk.white('Please specify the project name, '));
  console.log(
    chalk.white(
      'it will create a project with a new directory in your current location.'
    )
  );

  console.log(chalk.yellow(program.name()), chalk.yellow('<project-name>'));
  console.log();
  console.log(chalk.white('For example:'));
  console.log(chalk.yellow(program.name()), chalk.yellow('my-project'));
  console.log();
  console.log(
    chalk.white(
      `Run ${chalk.yellow(`${program.name()} --help`)} to see all options.`
    )
  );
  process.exit(1);
}

/**
 * init program
 */
function init() {

  //input projectName
  const targetPath = path.resolve(projectName);
  //app name
  appName = path.basename(targetPath);

  console.log(`creating a new project in ${chalk.white(targetPath)}`);

  spinner.start(chalk.yellow('creating project........'));

  //check the project folder
  if (fs.existsSync(targetPath)) {
    console.log(chalk.red('\nThis directory already exists'));
    console.log(chalk.red('For security, you can delete it manually'));
    process.exit(1);
  }
  fs.mkdir(targetPath, { recursive: true }, (err) => {
    if (err) {
      console.log(chalk.red('failed to create project directory'));
      process.exit(1);
    }
    //checkpath
    let realpath=isTypeScript?tspath:originalpath;
    download(`direct:${realpath}`, targetPath, { clone: true }, (err) => {
      if (err) {
        spinner.fail(chalk.red('faield to create project.'));
        process.exit(1);
      }
      //change created project name
      let packPath = `${targetPath}/package.json`;
      let resultPkg = require(packPath);
      resultPkg['name'] = appName;
      if (fs.existsSync(packPath)) {
        fs.unlinkSync(packPath);
      }
      fs.writeFile(packPath, JSON.stringify(resultPkg, null, 2), (err) => {
        if (err) {
          chalk.red('change the package name failed');
        }
      });

      spinner.succeed(chalk.white('project has been created.'));
    });
  });
}

module.exports = { init };
