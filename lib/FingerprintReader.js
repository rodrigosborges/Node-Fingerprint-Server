'use strict';

const events		= require('events');
const fs			= require('fs-extra');
const fprint 		= require('node-fprint');
const axios 		= require('axios');

class FingerprintReader extends events.EventEmitter {

	constructor( opts ) {
		super();

		this.opts = Object.assign({}, {
			deviceId	: undefined,
			debug		: false
		}, opts);

		fprint.setDebug(3);
		if( !fprint.init() ) throw new Error('fprint not loaded');

		this._settings = {};
		this._devices = [];
		this._state = undefined;

		let rawdata = fs.readFileSync('config.json')
		let config = JSON.parse(rawdata)
		this._configs = config

	}

	init() {
		this._refreshDevices();
		this._initDevice();

		return this;
	}

	_debug() {
		if( this.opts.debug ) this._log.apply( null, arguments );
	}

	_log() {
		console.log.apply( null, arguments );
	}

	_refreshDevices() {
		this._debug('_refreshDevices');

		this._devices = fprint.discoverDevices();
		if( this._devices.length < 1 ) throw new Error('no devices found');

		this._devices.forEach((device, i) => {
			this._log('device found:', device)
		});

	}

	_initDevice() {
		this._debug('_initDevice');

		if( this._devices.indexOf( this.opts.deviceId ) < 0 )
			throw new Error(`device not found: ${this.opts.deviceId}`);

		this._log('using device:', this.opts.deviceId);

		this._deviceHandle = fprint.openDevice( this.opts.deviceId );
	}

	_stopIdentify( callback ) {
		this._debug('_stopIdentify');

		callback = callback || function(){}

		if( this._state === 'identify' ) {
			fprint.identifyStop( this._deviceHandle, () => {
				this._state = undefined;
				callback();
			});
		}else if( this._state === 'enroll' ){
			fprint.enrollStop( this._deviceHandle, () => {
				this._state = undefined;
				callback();
			})
		} else {
			callback();
		}

	}

	_startIdentifyServer( connection ) {
		
		this._stopIdentify(() => {
			
			this._debug('_startIdentifyServer');
			
			axios.get(`${this._configs.server}/api/funcionario/frequencia/biometricUsers`).then(response => {
				
				let usersArray = [];

				let users = [];

				users = response.data

				users.forEach(( user ) => {
					usersArray.push( user.biometria );
				});

				this._state = 'identify';
		
				fprint.identifyStart(this._deviceHandle, usersArray, ( state, message, index ) => {
					this._debug('identifyStart state', state, 'message', message, 'index', index)
		
					this._state = 'identify';
		
					if( message === 'identify-succeeded' ){

						this._state = undefined

						fprint.identifyStop( this._deviceHandle, () => {

							axios({
								url: `${this._configs.server}/api/funcionario/frequencia/ponto/${users[ index ].id}`,
								method: 'post',
							}).then(response => {
								connection.emit('identify',{
									type: 'success',
									data: {
										'id'			: users[ index ].id,
										'nome'			: users[ index ].nome,
										'data'			: response.data
									}
								})
							})
							.catch(res => {
								connection.emit('identify',{
									type: 'error',
									data: 'Erro de conexão com o servidor.'
								})
							})
						})
					}else{
						setTimeout(() => {
							this._stopIdentify(() => {
								setTimeout(() => {
									this._startIdentifyServer(connection);
								}, 300);
							});
						});
					}
				});
			})
			.catch(res => {
				connection.emit('identify',{
					type: 'error',
					data: 'Erro de conexão com o servidor.'
				})
			})
		})
	}

	_addBiometry( connection, id ) {

		this._debug('_addBiometry');

		this._stopIdentify(() => {

			this._state = 'enroll';

			fprint.enrollStart( this._deviceHandle, ( state, message, fingerprint ) => {

				connection.emit('biometryCheck', true)
				
				if( message === 'enroll-completed' ) {


	                fprint.enrollStop( this._deviceHandle, () => {

						this._state = undefined;

						axios({
							url: `${this._configs.server}/api/funcionario/frequencia/biometry/${id}`,
							method: 'post',
							data:{
								biometria: fingerprint	
							}
						})

						.then(response => {
							connection.emit('addBiometry',{
								type: 'success',
								data: true
							})
						})

						.catch(res => {
							connection.emit('addBiometry',{
								type: 'error',
								data: 'Erro de conexão com o servidor.'
							})
						})

	                });
				}

	        });

        });

	}

	_getUsers( connection, page ) {
		this._debug('_getUsers');

		this._stopIdentify(() => {

			axios.get(`${this._configs.server}/api/funcionario/frequencia/list?page=${page}`)

			.then(response => {
				connection.emit('users', {
					type: 'success',
					data: response.data
				});
			})
			
			.catch(res => {
				connection.emit('users', {
					type: 'error',
					data: 'Erro de conexão com o servidor.'
				})
			})
		})
	}

}

module.exports = FingerprintReader;
