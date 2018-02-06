import 'reflect-metadata';

import * as SocketIo from 'socket.io-client';

import { IUser } from '../../models';

/**
 * The SocketIO.
 * By: David Zarandi (Azuwey)
 *
 * @class SocketIO
 */
export class SocketIO {
	private static _instance: SocketIO = new SocketIO();
	private _socket: SocketIo;

	/**
	 * Constructor.
	 * 
	 * @class SocketIO
	 * @constructor
	 */
	constructor() {
		if (SocketIO._instance){
			throw new Error('Error: Instantiation failed: Use SocketIO.getInstance() instead of new.');
		} else {
			SocketIO._instance = this;
			this._socketConnectionSetup();
		}
	}

	/**
	 * Return singleton instance
	 *
	 * @class SocketIO
	 * @method getInstance
	 * @returns SocketIO
	 */
	public static getInstance(): SocketIO {
		return SocketIO._instance;
	}

	/**
	 * Setup socket connection
	 *
	 * @class SocketIO
	 * @method _socketSetup
	 */
	private _socketConnectionSetup(): void {
		let socketAdrress = `ws://${process.env.socketAddress}:${process.env.socketPort}`;
		this._socket = SocketIo(socketAdrress, );
		this._socket.close();
	}

	/**
	 * Emit a login request without token
	 *
	 * @class SocketIO
	 * @param { Function } callback
	 * @method emitLoginWithoutTokenRequest
	 */
	public emitLoginWithoutTokenRequest(user: { username: string, password: string }, callback: Function): void {
		this._socket.on('acceptLogin', (response: { token: string, user: IUser }) => {
			this._socket.removeAllListeners('acceptLogin');
			this._socket.close();
			callback(null, response);
		});
		this._socket.on('deniedLogin', (errorMessage: string) => {
			this._socket.removeAllListeners('deniedLogin');
			this._socket.close();
			callback(errorMessage, null);
		});
		this._tryMultiple((errorMessage: string) => {
			if (errorMessage) {
				callback(errorMessage, null);
			} else {
				this._socket.emit('loginWithoutToken', user);
			}
		});
	}

	/**
	 * Emit a login request with token
	 *
	 * @class SocketIO
	 * @param { Function } callback
	 * @method emitLoginWithTokenRequest
	 */
	public emitLoginWithTokenRequest(token: string, callback: Function): void {
		this._socket.on('acceptLogin', (response: { user: IUser }) => {
			this._socket.removeAllListeners('acceptLogin');
			this._socket.close();
			callback(null, response);
		});
		this._socket.on('deniedLogin', (errorMessage: string) => {
			this._socket.removeAllListeners('deniedLogin');
			this._socket.close();
			callback(errorMessage, null);
		});
		this._tryMultiple((errorMessage: string) => {
			if (errorMessage) {
				callback(errorMessage, null);
			} else {
				this._socket.emit('loginWithToken', token);
			}
		});
	}

	public querySkillTree(token: string | undefined, callback: Function) {
		
		this._socket.on('acceptSkillTreeQuery', (response: { user: IUser }) => {
			this._socket.removeAllListeners('acceptSkillTreeQuery');
			this._socket.close();
			callback(null, response);
		});
		this._socket.on('deniedSkillTreeQuery', (errorMessage: string) => {
			this._socket.removeAllListeners('deniedSkillTreeQuery');
			this._socket.close();
			callback(errorMessage, null);
		});
		this._tryMultiple((errorMessage: string) => {
			if (errorMessage) {
				callback(errorMessage, null);
			} else {
				this._socket.emit('querySkillTree', token);
			}
		});
	}

	private _tryMultiple(callback: Function, timout: number = 1000, maximumTryCount: number = 3): void {
		console.log(this._socket.connected);
		!this._socket.connected && this._socket.open();
		let counter = 1;
		let timer = setInterval(() => {
			if (counter >= maximumTryCount) {
				clearInterval(timer);
				this._socket.close();
				callback('Max try count is reached');
			} else {
				if (this._socket.connected) {
					callback(null);
					clearInterval(timer);
				} else {
					++counter;
				}
			}
		}, timout);
	}
}