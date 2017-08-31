#!/usr/bin/env nodejs
// jshint asi: true
// jshint esversion: 6

"use strict"

const http = require("http")
const os = require("os")
const fs = require("fs")
const path = require("path")
const url = require("url")

const HOSTNAME = process.argv[2] || "localhost"
const PORT = 50000

const ROUTER = {
	"/": {"GET": serve_app },
	"/static": {"GET": serve_static},
	"/api": {"POST": APIListener}}

const API = {
	"listdir": listdir,
	"allfiles": allfiles }

const MIMES = {
	"jpg": "image/jpeg",
	"jpeg": "image/jpeg",
	"png": "image/png",
	"gif": "image/gif",
	"webp": "image/webp",
	"bmp": "image/bmp" }

function determine_mime_type(pathname) {
	const ext = path.extname(pathname).toLowerCase()
	return MIMES[ext] || "application/octet-stream" }

function serve_not_found(res) {
	res.writeHead(404, {"Content-Type": "text/plain"})
	res.end("Not found") }

function serve_method_not_allowed(res) {
	res.writeHead(405, {"Content-Type": "text/plain"})
	res.end("Method not allowed") }

function serve_bad_request(res) {
	res.writeHead(400, {"Content-Type": "text/plain"})
	res.end("Bad request") }

function serve_json(res, obj) {
	res.writeHead(200, {"Content-Type": "application/json"})
	res.end(JSON.stringify(obj)) }

function RequestListener(req, res) {
	req.url = url.parse(req.url, true)
	const route = ROUTER[req.url.pathname]
	if (route === undefined) serve_not_found(res)
	else if (route[req.method] === undefined) serve_method_not_allowed(res)
	else route[req.method](req, res) }

function serve_static(req, res) {
	if (!req.url.query.file) return serve_bad_request(res)
	const pathname = decodeURIComponent(req.url.query.file)
	const mimetype = determine_mime_type(pathname)
	fs.access(pathname, fs.constants.R_OK, err => {
		if (err) return serve_not_found(res)
		const filestream = fs.createReadStream(pathname)
		res.writeHead(200, {"Content-Type": mimetype})
		filestream.pipe(res) }) }

function serve_app(req, res) {
	res.writeHead(200, {"Content-Type": "text/html" })
	fs.createReadStream(get_asset("gallery.html")).pipe(res) }

function APIListener(req, res) {
	extract_post_data(req, data => {
		let obj
		try { obj = JSON.parse(data) }
		catch (e) { return serve_bad_request(res) }
		if (! API[obj.fn]) return serve_bad_request(res)
		else API[obj.fn](res, ...obj.args) }) }

function extract_post_data(req, cb) {
	let data = ""
	req.on("data", chunk => { data += chunk })
	req.on("end", () => { cb(data) }) }

function listdir(res, directory) { serve_json(res, fs.readdirSync(directory)) }

function allfiles(res, root) {
	const results = []
	const queue = [root]
	for (let i = 0; i < queue.length; i++) {
		const dir = queue[i]
		const entries = fs.readdirSync(dir).map(entry => {
			return path.join(dir, entry) })
		entries.forEach(entry => {
			const stat = fs.statSync(entry)
			if (stat.isFile()) results.push(entry)
			else if (stat.isDirectory()) queue.push(entry) }) }
	serve_json(res, results) }

function get_asset(what) {
	const attempts = [
		path.join(os.homedir(), ".local/share/webgallery"),
		"/usr/local/share/webgallery",
		"/usr/share/webgallery"]
	for (let i = 0; i < 3; i++) {
		const pathname = path.join(attempts[i], what)
		try {
			fs.accessSync(pathname, fs.constants.R_OK)
			return pathname }
		catch (e) { continue }}
	throw new Error(what + " not found in shared directories") }

function main() {
	const server = http.createServer(RequestListener)
	server.listen(PORT, HOSTNAME, () => {
		console.log("Listening to", HOSTNAME, ":", PORT) }) }

main()
