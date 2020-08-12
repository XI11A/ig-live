const { IgApiClient, LiveEntity } = require('instagram-private-api')
const child_process = require('child_process')
const killProcess = require('tree-kill')
const readline = require('readline')
const colors = require('colors')
const fs = require('fs')
const config = require('./config')

const ig = new IgApiClient()

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
})

const login = async IGCreds => {
	ig.state.generateDevice(IGCreds.username)
	// ig.state.proxyUrl = process.env.IG_PROXY;
	await ig.qe.syncLoginExperiments()
	await ig.account.login(IGCreds.username, IGCreds.password)
}

const startStream = async (videoPath, IGCreds) => {
	try {
		await login(IGCreds)

		const { broadcast_id, upload_url } = await ig.live.create({
			// create a stream in 720x1280 (9:16)
			previewWidth: 720,
			previewHeight: 1280
			// this message is not necessary, because it doesn't show up in the notification
			// message: 'My message',
		})

		const { stream_key, stream_url } = LiveEntity.getUrlAndKey({
			broadcast_id,
			upload_url
		})

		const startInfo = await ig.live.start(broadcast_id)
		if (startInfo.status !== 'ok') {
			return false
		}

		ig.live.unmuteComment(broadcast_id)
		console.log(stream_key.green)

		// this should be changed to single ffmpeg process instead of tee
		const ffmpegProcess = runCMD(
			`ffmpeg -re -i "${videoPath}" -c:a aac -c:v libx264 -f flv "rtmps://live-upload.instagram.com:443/rtmp/${stream_key}"`,
			() => killProcess(ffmpegProcess.pid)
		)

		return {
			key: stream_key,
			url: stream_url,
			broadcastId: broadcast_id,
			processId: ffmpegProcess.pid
		}
	} catch (err) {
		console.log(err)
		return false
	}
}


const runCMD = (command, cb) => {
	const cmd = child_process.exec(command, cb)
	cmd.stdout.on('data', data => {
		console.log(data.toString())
	})
	cmd.stderr.on('data', data => {
		console.log(data.toString())
	})
	return cmd
}


const start = async path => {
	if(!fs.existsSync(path)) {
		console.log('File does not exist'.bold.red)
		askPath()
		return
	}

	console.log('logging in to instagram ...'.bold.green)

	const stream = await startStream(path, {
		password: config.pass,
		username: config.user
	})

	console.log('streaming', stream)
}

const askPath = () => rl.question(
	'Please Enter video file full path: ', 
	(path) => {
		start(path)
	}
)

askPath()

