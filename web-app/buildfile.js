const vite = require("vite");

vite.build({
    root: '.',
    mode: 'build',
    build: {
        watch: false,
        write: false
    },
}).then(v => {
    console.log(v.output.map(r => r.fileName))
})
