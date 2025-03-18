// electron-devtools.js
const { session } = require('electron');
const path = require('path');

async function installDevTools() {
    const { default: installExtension, REACT_DEVELOPER_TOOLS, REDUX_DEVTOOLS } =
        require('electron-devtools-installer');

    try {
        const reactDevTools = await installExtension(REACT_DEVELOPER_TOOLS);
        const reduxDevTools = await installExtension(REDUX_DEVTOOLS);
        console.log(`Added Extension: ${reactDevTools.name}`);
        console.log(`Added Extension: ${reduxDevTools.name}`);
    } catch (err) {
        console.log('An error occurred: ', err);
    }
}

module.exports = { installDevTools };