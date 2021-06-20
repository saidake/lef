#!/usr/bin/env node

/**
 * Copyright (c) 2021-present, saidake@qq.com, Inc.
 *
 */

'use strict';
//check version
var currentNodeVersion = process.versions.node;
var majorVersion = currentNodeVersion.split('.')[0];

if (majorVersion < 10) {
  console.error(
    'You are running Node ' +
      currentNodeVersion +
      '.\n' +
      'Create the simple project requires Node 10 or higher. \n' +
      'Please update your version of Node.'
  );
  process.exit(1);
}

const { init } = require('./bin/lef.js');

init();