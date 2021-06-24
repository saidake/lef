"use strict";

const download = require("download-git-repo");
const envinfo = require("envinfo");
const chalk = require("chalk");
const path = require("path");
const os = require("os");
const spawn = require("cross-spawn");
const ora = require("ora");
const commander = require("commander");
const fs = require("fs-extra");
const spinner = ora("creating");

// other package
const https = require("https");
// const dns = require("dns");
const execSync = require("child_process").execSync;
// const hyperquest = require("hyperquest");
// const prompts = require("prompts");
const semver = require("semver");
// const tmp = require("tmp");
// const unpack = require("tar-pack").unpack;
// const url = require("url");
const validateProjectName = require("validate-npm-package-name");

// variable
const packageJson = require("../package.json");

spinner.color = "yellow";
spinner.text = "Loading rainbows";

// input projectname
let projectName;

//project dependencies package
const PROJECT_TOOL={
  reactDefault:"@saidake/lef-react-default",
  reactTypescript:"@saidake/lef-react-typescript", 
  installTool:"@saidake/lef-install"
}


//project dependencies to check projectName
const PROJECT_DEPENDENCIES = ["@saidake/lef-install"];
const VALID_FILES = [
  ".DS_Store",
  ".git",
  ".gitattributes",
  ".gitignore",
  ".gitlab-ci.yml",
  ".hg",
  ".hgcheck",
  ".hgignore",
  ".idea",
  ".npmignore",
  ".travis.yml",
  "docs",
  "LICENSE",
  "README.md",
  "mkdocs.yml",
  "Thumbs.db",
];
// These files should be allowed to remain on a failed install, but then
// silently removed during the next create.
const ERROR_FILE_PATTERNS = [
  "npm-debug.log",
  "yarn-error.log",
  "yarn-debug.log",
];

// -----------------------------------------------init program-----------------------------------------------//
function init() {
  // config command--------------------||
  const program = new commander.Command(packageJson.name)
    .version(packageJson.version, "-v,--version", "print version number")
    .arguments("[project-name]")
    .usage("<project-name> [options]")
    .action((name) => {
      projectName = name;
    })
    .allowUnknownOption()
    .description("this command can help you to create a simple project")
    .option("--info", "print package info")
    .option("--env", "print your environment info")
    .option("--typescript", "create typescript project")
    .on("--help", () => {
      console.log();
      console.log(`Only ${chalk.cyanBright("<project-name>")} is required.`);
      console.log(
        `the git homepage help you to start: ${chalk.white(
          `${packageJson.homepage}`
        )}`
      );
    })
    .on("option:info", () => {
      console.log(
        `\n  current version of ${packageJson.name}: ${packageJson.version}`
      );
      process.exit(1);
    })
    .parse(process.argv);
  // check input env options--------------------||
  if (program.opts().env) {
    console.log(chalk.bold("\nEnvironment Info:"));
    console.log(`  running from ${__dirname}`);
    return envinfo
      .run(
        {
          System: ["OS", "CPU"],
          Binaries: ["Node", "npm", "Yarn"],
          Browsers: [
            "Chrome",
            "Edge",
            "Internet Explorer",
            "Firefox",
            "Safari",
          ],
          // npmPackages: ["@saidake/lef-install"],
          // npmGlobalPackages: ['lef'],
        },
        {
          duplicates: true,
          showNotFound: true,
        }
      )
      .then(console.log);
  }

  // check project name--------------------||
  if (typeof projectName === "undefined") {
    console.log(chalk.white("Please specify the project name, "));
    console.log(
      chalk.white(
        "it will create a project with a new directory in your current location."
      )
    );

    console.log(chalk.yellow(program.name()), chalk.yellow("<project-name>"));
    console.log();
    console.log(chalk.white("For example:"));
    console.log(chalk.yellow(program.name()), chalk.yellow("my-project"));
    console.log();
    console.log(
      chalk.white(
        `Run ${chalk.yellow(`${program.name()} --help`)} to see all options.`
      )
    );
    process.exit(1);
  }

  checkForLatestVersion()
    .catch(() => {
      try {
        return console.log(
          "this is the lef latest version:",
          execSync("npm view lef version").toString().trim()
        );
      } catch (e) {
        return null;
      }
    })
    .then((latest) => {
      if (latest && semver.lt(packageJson.version, latest)) {
        console.log();
        console.error(
          chalk.yellow(
            `You are running (lef ${packageJson.version}), which is behind the latest release (lef ${latest}).\n`
          )
        );
        console.log();
        console.log(
          "Please remove any global installs with one of the following commands:\n" +
            "- npm uninstall -g lef\n" +
            "- yarn global remove lef"
        );
        console.log();
        process.exit(1);
      } else {
        createProject(projectName, program.opts().typescript);
      }
    });
}

// -----------------------------------------------create lef project-----------------------------------------------//
function createProject(projectName, isTypeScript) {
  // check node version--------------------||
  const supportedNodeVersion = semver.satisfies(process.version, ">=10");
  if (!supportedNodeVersion) {
    console.log(
      chalk.yellow(
        `You are using Node ${process.version} so the project will be bootstrapped with an old unsupported version of tools.\n\n` +
          `Please update to Node 10 or higher for a better, fully supported experience.\n`
      )
    );
    process.exit(1);
  }

  const projectRootDir = path.resolve(projectName);

  // validate projectName--------------------||
  checkProjectName(projectName);
  // ==========================================================================result path
  const resultPath = fs.ensureDirSync(projectName);
  if (!isSafeToCreateProjectIn(projectRootDir, projectName)) {
    process.exit(1);
  }

  console.log();
  console.log(`Creating a new Lef Project in ${chalk.green(projectRootDir)}.`);
  console.log();

  // create package.json file--------------------||
  const packageJson = {
    name: projectName,
    version: "0.1.0",
    private: true,
  };

  // create package.json to new dir
  fs.writeFileSync(
    path.join(projectRootDir, 'package.json'),
    JSON.stringify(packageJson, null, 2) + os.EOL
  );
  const hasYarn = checkHasYarn();

  const originalProcessDirectory = process.cwd();
  process.chdir(projectRootDir);

  // check npm command--------------------||
  // if (!hasYarn && !checkThatNpmCanReadCwd()) {
  //   process.exit(1);
  // }
  // pass the step,........  there is some problem...

  // check npm and yarn's version --------------------||
  if (!hasYarn) {
    const npmInfo = checkNpmVersion();
    if (npmInfo.hasMinNpm) {
      console.log(
        chalk.yellow(
          `You are using npm ${npmInfo.npmVersion} so the project will be bootstrapped with an old unsupported version of tools.\n\n` +
            `Please update to npm 6 or higher for a better, fully supported experience.\n`
        )
      );
    }
  } else {
    const yarnInfo = checkYarnVersion();
    if (yarnInfo.yarnVersion) {
      if (!yarnInfo.hasMinYarnPnp) {
        console.log(
          chalk.yellow(
            `You are using Yarn ${yarnInfo.yarnVersion} together with the --use-pnp flag, but Plug'n'Play is only supported starting from the 1.12 release.\n\n` +
              `Please update to Yarn 1.12 or higher for a better, fully supported experience.\n`
          )
        );
        // 1.11 had an issue with webpack-dev-middleware, so better not use PnP with it (never reached stable, but still)
      }
      if (!yarnInfo.hasMaxYarnPnp) {
        console.log(
          chalk.yellow(
            "The --use-pnp flag is no longer necessary with yarn 2 and will be deprecated and removed in a future release.\n"
          )
        );
        // 2 supports PnP by default and breaks when trying to use the flag
      }
    }
  }

  // check yarn registry--------------------||
  if (hasYarn) {
    let yarnUsesDefaultRegistry = true;
    try {
      yarnUsesDefaultRegistry =
        execSync("yarnpkg config get registry").toString().trim() ===
        "https://registry.yarnpkg.com";
    } catch (e) {}
  }

  // download project--------------------||
  downloadProjectFiles(
    projectRootDir,
    projectName,
    originalProcessDirectory,
    hasYarn,
    isTypeScript
  );
}

// -----------------------------------------------downloadProjectFiles-----------------------------------------------//
async function downloadProjectFiles(
  projectRootDir,
  projectName,
  originalProcessDirectory,
  hasYarn,
  isTypeScript
) {
  console.log("Installing packages. This might take a couple of minutes.");
  
  // important change-------------------------------------------------------------------------start
  const installPackageName=PROJECT_TOOL.installTool;
  const templatePackageName=PROJECT_TOOL.reactDefault;

  if(isTypeScript){
    templatePackageName=PROJECT_TOOL.reactTypescript
  }
  // important change-------------------------------------------------------------------------end
  
  // install two package--------------------||
  install(
    projectRootDir,
    hasYarn,
    [templatePackageName, installPackageName],
    true
  )
    .then(async () => {
      await executeNodeScript(
        {
          currentPath: process.cwd(),
          args: [],
        },
        [projectRootDir, projectName, hasYarn,templatePackageName,originalProcessDirectory],
        `
        var init = require('${installPackageName}/init.js');
        init.apply(null, JSON.parse(process.argv[1]));
      `
      );
      console.log(chalk.yellow("\nThe lef project created successfully!"));
      process.exit(1);
    })
    .catch(() => {
      console.log(chalk.red("\nThe lef project creation failed! "));
      process.exit(1);
    });
}

// -----------------------------------------------execute lef-install scripts-----------------------------------------------//
function executeNodeScript({ currentPath, args }, dataArray, execScript) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [...args, "-e", execScript, "--", JSON.stringify(dataArray)],
      { currentPath, stdio: "inherit" }
    );

    child.on("close", (code) => {
      if (code !== 0) {
        reject({
          command: `node ${args.join(" ")}`,
        });
        return;
      }
      resolve();
    });
  });
}
// -----------------------------------------------download template and scripts-----------------------------------------------//
function install(projectRootDir,hasYarn, dependencies, isOnline) {
  return new Promise((resolve, reject) => {

    let command;
    let args;
    if (hasYarn) {

      command = "yarnpkg";
      args = ["add", "--exact"];
      if (!isOnline) {
        args.push("--offline");
      }

      [].push.apply(args, dependencies);
      args.push("--cwd");
      args.push(projectRootDir);



      if (!isOnline) {
        console.log(chalk.yellow("You appear to be offline."));
        console.log(chalk.yellow("Falling back to the local Yarn cache."));
        console.log();
      }
    } else {
      command = "npm";
      args = [
        "install",
        "--save",
        "--save-exact",
        "--loglevel",
        "error",
      ].concat(dependencies);
    }
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("close", (code) => {
      if (code !== 0) {
        reject({
          command: `${command} ${args.join(" ")}`,
        });
        return;
      }
      resolve();
    });
  });
}

// -----------------------------------------------check yarn version-----------------------------------------------//
function checkYarnVersion() {
  const minYarnPnp = "1.12.0";
  const maxYarnPnp = "2.0.0";
  let hasMinYarnPnp = false;
  let hasMaxYarnPnp = false;
  let yarnVersion = null;
  try {
    yarnVersion = execSync("yarnpkg --version").toString().trim();
    if (semver.valid(yarnVersion)) {
      hasMinYarnPnp = semver.gt(yarnVersion, minYarnPnp);
      hasMaxYarnPnp = semver.lt(yarnVersion, maxYarnPnp);
    } else {
      // Handle non-semver compliant yarn version strings, which yarn currently
      // uses for nightly builds. The regex truncates anything after the first
      // dash. See #5362.
      const trimmedYarnVersionMatch = /^(.+?)[-+].+$/.exec(yarnVersion);
      if (trimmedYarnVersionMatch) {
        const trimmedYarnVersion = trimmedYarnVersionMatch.pop();
        hasMinYarnPnp = semver.gt(trimmedYarnVersion, minYarnPnp);
        hasMaxYarnPnp = semver.lt(trimmedYarnVersion, maxYarnPnp);
      }
    }
  } catch (err) {
    // ignore
  }
  return {
    hasMinYarnPnp: hasMinYarnPnp,
    hasMaxYarnPnp: hasMaxYarnPnp,
    yarnVersion: yarnVersion,
  };
}

// -----------------------------------------------check npm version-----------------------------------------------//
function checkNpmVersion() {
  let hasMinNpm = false;
  let npmVersion = null;
  try {
    npmVersion = execSync("npm --version").toString().trim();
    hasMinNpm = semver.lt(npmVersion, "6.0.0");
  } catch (err) {
    // ignore
  }
  return {
    hasMinNpm: hasMinNpm,
    npmVersion: npmVersion,
  };
}

// -----------------------------------------------check the npm cwd situation-----------------------------------------------//
function checkThatNpmCanReadCwd() {
  const cwd = process.cwd();
  let childOutput = null;
  let resultFlag = true;
  try {
    childOutput = spawn.sync("npm", ["config", "list"]).output.join("");
  } catch {
    resultFlag = false;
  }
  if (typeof childOutput !== "string") {
    resultFlag = false;
  }
  const lines = childOutput.split("\n");
  const prefix = "; cwd = ";

  const line = lines.find((line) => line.startsWith(prefix));
  if (typeof line !== "string") {
    resultFlag = false;
  }

  const npmCWD = line.substring(prefix.length);
  if (npmCWD != cwd) {
    resultFlag = false;
  }
  if (!resultFlag) {
    console.error(
      chalk.red(
        `Could not start an npm process in the right directory.\n\n` +
          `The current directory is: ${chalk.bold(cwd)}\n` +
          `However, a newly started npm process runs in: ${chalk.bold(
            npmCWD
          )}\n\n` +
          `This is probably caused by a misconfigured system terminal shell.`
      )
    );
    if (process.platform === "win32") {
      console.error(
        chalk.red(`On Windows, this can usually be fixed by running:\n\n`) +
          `  ${chalk.cyan(
            "reg"
          )} delete "HKCU\\Software\\Microsoft\\Command Processor" /v AutoRun /f\n` +
          `  ${chalk.cyan(
            "reg"
          )} delete "HKLM\\Software\\Microsoft\\Command Processor" /v AutoRun /f\n\n` +
          chalk.red(`Try to run the above two lines in the terminal.\n`) +
          chalk.red(
            `To learn more about this problem, read: https://blogs.msdn.microsoft.com/oldnewthing/20071121-00/?p=24433/`
          )
      );
    }
    process.exit(1);
  }
  return true;
}

// -----------------------------------------------check yarn command is available-----------------------------------------------//
function checkHasYarn() {
  try {
    execSync("yarnpkg --version", { stdio: "ignore" });
    return true;
  } catch (e) {
    return false;
  }
}

// -----------------------------------------------check the project path is safe-----------------------------------------------//
function isSafeToCreateProjectIn(projectRootDir, projectName) {
  const conflicts = fs
    .readdirSync(projectRootDir)
    .filter((file) => !VALID_FILES.includes(file)) 
    // IntelliJ IDEA creates module files before CRA is launched
    .filter((file) => !/\.iml$/.test(file))
    // Don't treat log files from previous installation as conflicts
    .filter(
      (file) => !ERROR_FILE_PATTERNS.some((pattern) => file.startsWith(pattern))
    );

  if (conflicts.length > 0) {
    console.log(
      `The directory ${chalk.green(
        projectName
      )} contains files that could conflict:`
    );
    console.log();
    for (const file of conflicts) {
      try {
        const stats = fs.lstatSync(path.join(projectRootDir, file));
        if (stats.isDirectory()) {
          console.log(`  ${chalk.blue(`${file}/`)}`);
        } else {
          console.log(`  ${file}`);
        }
      } catch (e) {
        console.log(`  ${file}`);
      }
    }
    console.log();
    console.log(
      "Either try using a new directory name, or remove the files listed above."
    );

    return false;
  }

  // Remove any log files from a previous installation.
  fs.readdirSync(projectRootDir).forEach((file) => {
    if (isErrorLog(file)) {
      fs.removeSync(path.join(projectRootDir, file));
    }
  });
  return true;
}

// -----------------------------------------------Check if the projectName is legal-----------------------------------------------//
function checkProjectName(projectName) {
  const validationResult = validateProjectName(projectName);
  if (!validationResult.validForNewPackages) {
    console.error(
      chalk.red(
        `Cannot create a project named ${chalk.green(
          `"${projectName}"`
        )} because of npm naming restrictions:\n`
      )
    );
    [
      ...(validationResult.errors || []),
      ...(validationResult.warnings || []),
    ].forEach((error) => {
      console.error(chalk.red(`  * ${error}`));
    });
    console.error(chalk.red("\nPlease choose a different project name."));
    process.exit(1);
  }
  //check dependencies name
  const dependencies = PROJECT_DEPENDENCIES.sort();
  if (dependencies.includes(projectName)) {
    console.error(
      chalk.red(
        `Cannot create a project named ${chalk.green(
          `"${projectName}"`
        )} because a dependency with the same name exists.\n` +
          `Due to the way npm works, the following names are not allowed:\n\n`
      ) +
        chalk.cyan(dependencies.map((depName) => `  ${depName}`).join("\n")) +
        chalk.red("\n\nPlease choose a different project name.")
    );
    process.exit(1);
  }
}

// -----------------------------------------------check for the package version-----------------------------------------------//
function checkForLatestVersion() {
  return new Promise((resolve, reject) => {
    https
      .get("https://registry.npmjs.org/-/package/lef/dist-tags", (res) => {
        if (res.statusCode == 200) {
          let resultData = "";
          res.on("data", (data) => (resultData += data));
          res.on("end", () => {
            resolve(JSON.parse(resultData).latest);
          });
        } else {
          reject();
        }
      })
      .on("error", () => {
        reject();
      });
  });
}

module.exports = { init };
