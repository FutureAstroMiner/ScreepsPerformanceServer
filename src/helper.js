import fs from 'fs';
import fetch from 'node-fetch';
import _ from 'lodash';

import { ScreepsAPI } from 'screeps-api';
import { exec, execSync } from 'child_process';

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
let Config;
import minimist from 'minimist'
const argv = minimist(process.argv.slice(2));

const isWindows = process.platform === 'win32';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const basicCommand = "docker-compose";

const filter = {
  controller: (o) => {
    if (o && o.type) {
      return o.type === 'controller';
    }
    return false;
  },
  creeps: (o) => {
    if (o && o.type) {
      return o.type === 'creep';
    }
    return false;
  },
  structures: (o) => {
    if (o && o.type) {
      return o.type === 'spawn' || o.type === 'extension';
    }
    return false;
  },
};

const hostname = '127.0.0.1';

export default class Helper {
  static async setConfig(config) {
    Config = config;
  }

  /**
      * followLog method
      *
      * Connects to the api and reads and prints the console log, if messages
      * are available
      *
      * @param {list} rooms - The rooms
      * @param {function} statusUpdater - Function to handle status updates
      * @return {undefined}
      */
  static async followLog(rooms, statusUpdater, serverPort) {
    rooms.forEach(async (room) => {
      const api = new ScreepsAPI({
        email: room,
        password: 'password',
        protocol: 'http',
        hostname,
        port: serverPort,
        path: '/',
      });

      await api.auth();

      api.socket.connect();
      api.socket.on('connected', () => { });
      api.socket.on('auth', () => { });
      api.socket.subscribe(`room:${room}`, statusUpdater);
    });
  }
  /**
   * Spawn bot
   * @param {string} botName
   * @param {string} roomName
   */

  static async spawnBot(botName, roomName, roomsSeen, cliPort) {
    console.log(`Spawn ${botName} in ${roomName}`);
    await this.executeCliCommand(`bots.spawn('${botName}', '${roomName}', {username: '${roomName}', auto:'true'})\r\n`, cliPort);
    await this.setPassword(roomName, roomsSeen, Config.playerRooms, cliPort);
  }

  /**
      * sets password for user
      *
      * @param {string} line
      * @param {object} socket
      * @param {list} rooms
      * @param {object} roomsSeen
      * @param {stringMap} playerRooms
      * @return {boolean}
      */
  static async setPassword(roomName, roomsSeen, playerRooms, cliPort) {
    // eslint-disable-next-line no-param-reassign
    roomsSeen[roomName] = true;
    console.log(`Set password for ${roomName}`);
    /* eslint max-len: ["error", 1300] */
    await this.executeCliCommand(
      // Password is 'password'
      `storage.db.users.update({username: '${roomName}'}, {$set: {password: 'd0347d74b308e046b399e151c3674297ddd1aba6d6e380c94ea8ec070393d17297a3407e9c17d3d4a308043e3fd219faecc9d0d4c548a6eab87549ec83fd0688197d14b84fa810935f694c14eadd6eac3b36e19405190b1e216b5c3b0b79f03815670ba8c0eb2e23d00f556b8fdfc35eaa6d3f8f734132196c70c921f29160b1f1a0ac1fe4c196c15aa7c2a5d8358ed89fff3ad4ddbe45f7fc5ecb1b4538940f31188a9a65af59b8481f6aa00fecebf4f8e7a91be877ec8610350a06bac16d666f255a73768a96cd1797c25c68aded637f96c7b0e9ad8e9f85997bced58c288f8df06f78b096750fadc128a345c01b76ab4f0feff6f5b89712ddfe6d9b7a713b05add43bd0c4b1c59b4a72d5b81a42570c0b1f7980a969913ba31baf88ef1213e46cb09577e249688e1d10be958e7c5dae4033a5cc174261b837b29134ea090df426ad9a3624fa2be2dbfd47c6a56d7cda99c30d74c05102b1ee05e09eba4cf3f785d40c94f22b24c4e47409f5ba123b98fa30d23498e07ee26d542487b3be480f7b51f23712aef06630d1ea1a057e44e0bb8fcc1709e457544051730140852e7b493b7d3cd23202405f3d81d605be47c792681ce2d548388feddad94f790d58fb887d89358c4c0b8a6d0148e01f7f2cfd613ac371d3e3bdc606189eafba726df2959c2ac6b4780068713cb79a687e65298a4aeee75a3ef47aab3a9b853407be', salt: '8592666ec92a801874b463ea4c0a0da519936246d54bc4c40391f9ac7c5a8000'}})\r\n`, cliPort
    );

    if (playerRooms[roomName]) {
      console.log(`Set steam id for ${roomName}`);
      await this.executeCliCommand(
        `storage.db.users.update({username: '${roomName}'}, {$set: {steam: {id: '${playerRooms[roomName]}'}}})\r\n`, cliPort
      );
    }
  }

  /**
      * sleep method
      *
      * Helper method to sleep for amount of seconds.
      * @param {number} seconds Amount of seconds to sleep
      * @return {object}
      */
  static sleep(seconds) {
    // eslint-disable-next-line no-promise-executor-return
    return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  }

  /**
      * startServer method
      *
      * Starts the private server
      * @return {object}
      */
  static async startServer() {
    const stopCommand = `${basicCommand} down --volumes --remove-orphans`;
    const upCommand = `${basicCommand} up`;
    const serverLogsCommand = `${basicCommand} logs -f screeps`;

    const maxTime = new Promise((resolve) => {
      setTimeout(resolve, 30 * 60 * 1000, 'Timeout');
    });

    const startServer = new Promise(async (resolve) => {
      console.log('\r\nProcess: Starting server...');
      console.log('Stopping server...')
      execSync(stopCommand, { stdio: argv.debug ? "inherit" : 'ignore' });
      const logsPath = join(__dirname, '../logs');
      if (!isWindows && fs.existsSync(logsPath)) {
        console.log("chmod logs folder");
        execSync(`sudo chmod -R 777 ${logsPath}`);
      }

      console.log('Starting server, this will take a while...')
      exec(upCommand);
      await this.sleep(10)

      let hitCountMissing = 1;
      const child = exec(serverLogsCommand, { stdio: 'pipe' });
      child.stdout.on('data', (data) => {
        const lines = data ? data.split(/(\r?\n)/g) : [];
        lines.forEach((line) => {
          if (argv.debug) console.log(line)
          if (line.includes('[main] exec: screeps-engine-main')) {
            hitCountMissing--;
            if (hitCountMissing === 0) resolve();
          }
        })
      });
    });
    return Promise.race([startServer, maxTime])
      .then((result) => {
        if (result === 'Timeout') {
          console.log('Timeout starting server!');
          return false;
        }
        return true;
      })
      .catch((result) => {
        console.error('error', { data: result });
        return false;
      });
  }

  static async restartServer() {

    const restartCommand = `${basicCommand} restart screeps`;
    const serverLogsCommand = `${basicCommand} logs -f screeps`;

    const maxTime = new Promise((resolve) => {
      setTimeout(resolve, 30 * 60 * 1000, 'Timeout');
    });

    const restartServer = new Promise(async (resolve) => {
      console.log('\r\nProcess: Restart server...')
      console.log('Restarting server...\r\n')
      exec(restartCommand);
      await this.sleep(10)

      let hitCountMissing = 2;
      const child = exec(serverLogsCommand, { stdio: 'pipe' });
      child.stdout.on('data', (data) => {
        const lines = data ? data.split(/(\r?\n)/g) : [];
        lines.forEach((line) => {
          if (argv.debug) console.log(line)
          if (line.includes('[main] exec: screeps-engine-main')) {
            hitCountMissing--;
            if (hitCountMissing === 0) resolve();
          }
        })
      });
    });
    return Promise.race([restartServer, maxTime])
      .then((result) => {
        if (result === 'Timeout') {
          console.log('Timeout starting server!');
          return false;
        }
        return true;
      })
      .catch((result) => {
        console.error('error', { data: result });
        return false;
      });
  }

  static initControllerID(event, status, controllerRooms) {
    if (status[event.id].controller === null) {
      // eslint-disable-next-line prefer-destructuring
      status[event.id].controller = _.filter(event.data.objects, filter.controller)[0];
      // eslint-disable-next-line no-underscore-dangle
      status[event.id].controller = status[event.id].controller._id;
      controllerRooms[status[event.id].controller] = event.id;
    }
  }

  static updateCreeps(event, status) {
    const creeps = _.filter(event.data.objects, filter.creeps);
    if (_.size(creeps) > 0) {
      status[event.id].creeps += _.size(creeps);
    }
  }

  static updateStructures(event, status) {
    const structures = _.filter(event.data.objects, filter.structures);
    if (_.size(structures) > 0) {
      status[event.id].structures += _.size(structures);
    }
  }

  static updateController(event, status, controllerRooms) {
    const controllers = _.pick(event.data.objects, Object.keys(controllerRooms));
    Object.keys(controllers).forEach((controllerId) => {
      const controller = controllers[controllerId];
      const roomName = controllerRooms[controllerId];
      if (status[roomName] === undefined) {
        return;
      }
      if (controller.progress >= 0) {
        status[roomName].progress = controller.progress;
      }
      if (controller.level >= 0) {
        status[roomName].level = controller.level;
      }
    });
  }

  static async sendResult(milestones, status, controllerStatus, lastTick, start) {
    if (!argv.exportUrl) return;
    let commitName = 'localhost';
    if (process.env.GITHUB_EVENT_PATH) {
      const file = fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8');
      const object = JSON.parse(file);
      commitName = object.commits[0].message;
    }

    const newControllerStatus = [];
    Object.keys(controllerStatus).forEach((roomName) => {
      const controller = controllerStatus[roomName];
      newControllerStatus.push({ roomName, controller });
    });
    controllerStatus = newControllerStatus;

    try {
      await fetch(argv.exportUrl, {
        method: 'POST',
        body: JSON.stringify({
          milestones, lastTick, status, commitName, startTime: start, endTime: Date.now(), controllerStatus
        }),
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      console.log('Failed to export status results to export url, high chance this isn\'t in use');
    }
  }

  static async executeCliCommand(command, cliPort) {
    try {
      const result = await fetch(`http://${hostname}:${cliPort}/cli`, {
        method: 'POST', body: command, headers: { 'Content-Type': 'text/plain' },
      });
      const text = await result.text();
      console.log(`> ${command}`);
      if (argv.debug) console.log(text);
      await this.sleep(1)
      return text;
    } catch (error) {
      console.log(error)
      return undefined;
    }
  }
}
