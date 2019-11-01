'use strict';

const express 			= require('express');
const cors				= require('cors');
const bodyParser		= require('body-parser');
const yargs 			= require('yargs').argv;

const FingerprintReader	= require('./lib/FingerprintReader.js');

const port = 4444;

const reader = new FingerprintReader({
	deviceId		: process.env.FPRINT_SERVER_DEVICE || yargs.device || 'Digital Persona U.are.U 4000/4000B/4500',
	debug			: true
}).init();

const app = express()
const server = require('http').createServer(app)
const socket = require('socket.io')
const io = socket(server)


	app.use( cors() )
	app.use( bodyParser.urlencoded({extended:true}) )

	// .use(( req, res, next ) => {
	// 	res.locals.success = function( message, statusCode ) {
	// 		return res
	// 			.status( statusCode || 200 )
	// 			.json(message)
	// 	}

	// 	next();

	// })

	// .get( '/api/start', ( req, res ) => {
	// 	var result = reader._startIdentifyServer( result => {
	// 		return res.locals.success( result );
	// 	});

	// })

	// .get( '/api/biometry/:id', ( req, res ) => {
	// 	var result = reader._addBiometry( req.params.id, result => {
	// 		return res.locals.success( result );
	// 	});

	// })

	// .get( '/api/users', ( req, res ) => {
	// 	var page = typeof req.query.page !== 'undefined' ? req.query.page : 1
	// 	var result = reader._getUsers( page, result => {
	// 		return res.locals.success( result );
	// 	});

	// })

	// .listen( port, () => {
	// 	console.log(`fprint server running on port ${port}...`);
	// });

	io.on('connection', function(connection){

		connection.on('identify', data => {
			reader._startIdentifyServer( connection )
		})

		connection.on('users', page => {
			reader._getUsers( connection, page )
		})

		connection.on('addBiometry', id => {
			reader._addBiometry( connection, id )
		})


	})


	server.listen(port)
