import type { Serialized } from '@rocket.chat/core-typings';
import type {
	MatchPathPattern,
	ParamsFor,
	OperationResult,
	PathFor,
	PathWithoutParamsFor,
	PathWithParamsFor,
} from '@rocket.chat/rest-typings';
import { stringify } from 'query-string';

import type { Middleware, RestClientInterface } from './RestClientInterface';
import { hasRequiredTwoFactorMethod, isTotpInvalidError, isTotpRequiredError } from './errors';

export { RestClientInterface };

const pipe =
	<T extends (...args: any[]) => any>(fn: T) =>
	(...args: Parameters<T>): ReturnType<T> =>
		fn(...args);

function buildFormData(data?: Record<string, any> | void, formData = new FormData(), parentKey?: string): FormData {
	if (data instanceof FormData) {
		return data;
	}
	if (!data) {
		return formData;
	}

	if (typeof data === 'object' && !(data instanceof File)) {
		Object.keys(data).forEach((key) => {
			buildFormData(formData, data[key], parentKey ? `${parentKey}[${key}]` : key);
		});
	} else {
		data && parentKey && formData.append(parentKey, data);
	}
	return formData;
}

const checkIfIsFormData = (data: any = {}): boolean => {
	if (data instanceof FormData) {
		return true;
	}
	return Object.values(data).some((value) => {
		if (value && typeof value === 'object' && !(value instanceof File)) {
			return checkIfIsFormData(value);
		}
		return value instanceof File;
	});
};

export class RestClient implements RestClientInterface {
	private twoFactorHandler?: (args: {
		method: 'totp' | 'email' | 'password';
		emailOrUsername?: string;
		invalidAttempt?: boolean;
	}) => Promise<string>;

	private readonly baseUrl: string;

	private headers: Record<string, string> = {};

	private credentials:
		| {
				'X-User-Id': string;
				'X-Auth-Token': string;
		  }
		| undefined;

	constructor({
		baseUrl,
		credentials,
		headers = {},
	}: {
		baseUrl: string;
		credentials?: {
			'X-User-Id': string;
			'X-Auth-Token': string;
		};
		headers?: Record<string, string>;
	}) {
		this.baseUrl = `${baseUrl}/api`;
		this.setCredentials(credentials);
		this.headers = headers;
	}

	getCredentials(): ReturnType<RestClientInterface['getCredentials']> {
		return this.credentials;
	}

	setCredentials: RestClientInterface['setCredentials'] = (credentials) => {
		this.credentials = credentials;
	};

	get<TPathPattern extends MatchPathPattern<TPath>, TPath extends PathWithParamsFor<'GET'> = PathWithParamsFor<'GET'>>(
		endpoint: TPath,
		params: ParamsFor<'GET', TPathPattern>,
		options?: Omit<RequestInit, 'method'>,
	): Promise<Serialized<OperationResult<'GET', TPathPattern>>>;

	get<TPathPattern extends MatchPathPattern<TPath>, TPath extends PathWithoutParamsFor<'GET'> = PathWithoutParamsFor<'GET'>>(
		endpoint: TPath,
		params?: undefined,
		options?: Omit<RequestInit, 'method'>,
	): Promise<Serialized<OperationResult<'GET', TPathPattern>>>;

	async get<TPathPattern extends MatchPathPattern<TPath>, TPath extends PathFor<'GET'>>(
		endpoint: TPath,
		params?: ParamsFor<'GET', TPathPattern>,
		options?: Omit<RequestInit, 'method'>,
	): Promise<Serialized<OperationResult<'GET', TPathPattern>>> {
		if (/\?/.test(endpoint)) {
			// throw new Error('Endpoint cannot contain query string');
			console.warn('Endpoint cannot contain query string', endpoint);
		}
		const queryParams = this.getParams(params);
		const response = await this.send(`${endpoint}${queryParams ? `?${queryParams}` : ''}`, 'GET', options ?? {});
		return response.json();
	}

	post<TPathPattern extends MatchPathPattern<TPath>, TPath extends PathWithParamsFor<'POST'> = PathWithParamsFor<'POST'>>(
		endpoint: TPath,
		params: ParamsFor<'POST', TPathPattern>,
		options?: Omit<RequestInit, 'method'>,
	): Promise<Serialized<OperationResult<'POST', TPathPattern>>>;

	post<TPathPattern extends MatchPathPattern<TPath>, TPath extends PathWithoutParamsFor<'POST'> = PathWithoutParamsFor<'POST'>>(
		endpoint: TPath,
		params?: undefined,
		options?: Omit<RequestInit, 'method'>,
	): Promise<Serialized<OperationResult<'POST', TPathPattern>>>;

	async post<TPathPattern extends MatchPathPattern<TPath>, TPath extends PathFor<'POST'>>(
		endpoint: TPath,
		params?: ParamsFor<'POST', TPathPattern>,
		{ headers, ...options }: Omit<RequestInit, 'method'> = {},
	): Promise<Serialized<OperationResult<'POST', TPathPattern>>> {
		const isFormData = checkIfIsFormData(params);

		const response = await this.send(endpoint, 'POST', {
			body: isFormData ? buildFormData(params) : JSON.stringify(params),

			headers: {
				Accept: 'application/json',
				...(!isFormData && { 'Content-Type': 'application/json' }),
				...headers,
			},

			...options,
		});

		// If the server sent no data, return an empty record as we're only expecting objects.
		if (response.status === 204) {
			return {} as any;
		}

		return response.json();
	}

	put<TPathPattern extends MatchPathPattern<TPath>, TPath extends PathWithParamsFor<'PUT'> = PathWithParamsFor<'PUT'>>(
		endpoint: TPath,
		params: ParamsFor<'PUT', TPathPattern>,
		options?: Omit<RequestInit, 'method'>,
	): Promise<Serialized<OperationResult<'PUT', TPathPattern>>>;

	put<TPathPattern extends MatchPathPattern<TPath>, TPath extends PathWithoutParamsFor<'PUT'> = PathWithoutParamsFor<'PUT'>>(
		endpoint: TPath,
		params?: undefined,
		options?: Omit<RequestInit, 'method'>,
	): Promise<Serialized<OperationResult<'PUT', TPathPattern>>>;

	async put<TPathPattern extends MatchPathPattern<TPath>, TPath extends PathFor<'PUT'>>(
		endpoint: TPath,
		params?: ParamsFor<'PUT', TPathPattern>,
		{ headers, ...options }: Omit<RequestInit, 'method'> = {},
	): Promise<Serialized<OperationResult<'PUT', TPathPattern>>> {
		const isFormData = checkIfIsFormData(params);
		const response = await this.send(endpoint, 'PUT', {
			body: isFormData ? buildFormData(params) : JSON.stringify(params),

			headers: {
				Accept: 'application/json',
				...(!isFormData && { 'Content-Type': 'application/json' }),
				...headers,
			},

			...options,
		});
		return response.json();
	}

	delete<TPathPattern extends MatchPathPattern<TPath>, TPath extends PathWithParamsFor<'DELETE'> = PathWithParamsFor<'DELETE'>>(
		endpoint: TPath,
		params: ParamsFor<'DELETE', TPathPattern>,
		options?: Omit<RequestInit, 'method'>,
	): Promise<Serialized<OperationResult<'DELETE', TPathPattern>>>;

	delete<TPathPattern extends MatchPathPattern<TPath>, TPath extends PathWithoutParamsFor<'DELETE'> = PathWithoutParamsFor<'DELETE'>>(
		endpoint: TPath,
		params?: undefined,
		options?: Omit<RequestInit, 'method'>,
	): Promise<Serialized<OperationResult<'DELETE', TPathPattern>>>;

	async delete<TPathPattern extends MatchPathPattern<TPath>, TPath extends PathFor<'DELETE'>>(
		endpoint: TPath,
		_params?: ParamsFor<'DELETE', TPathPattern>,
		options: Omit<RequestInit, 'method'> = {},
	): Promise<Serialized<OperationResult<'DELETE', TPathPattern>>> {
		const response = await this.send(endpoint, 'DELETE', options ?? {});
		return response.json();
	}

	protected getCredentialsAsHeaders(): Record<string, string> {
		const credentials = this.getCredentials();
		return credentials
			? {
					'X-User-Id': credentials['X-User-Id'],
					'X-Auth-Token': credentials['X-Auth-Token'],
			  }
			: {};
	}

	send(endpoint: string, method: string, { headers, ...options }: Omit<RequestInit, 'method'> = {}): Promise<Response> {
		console.log('endpoint from api-client index.ts', endpoint, method, options);
		return fetch(`${this.baseUrl}${`/${endpoint}`.replace(/\/+/, '/')}`, {
			...options,
			headers: { ...this.getCredentialsAsHeaders(), ...this.headers, ...headers },
			method,
		}).then(async (response) => {
			if (response.ok) {
				return response;
			}

			if (response.status !== 400) {
				return Promise.reject(response);
			}

			const clone = response.clone();

			const error = await clone.json();

			if ((isTotpRequiredError(error) || isTotpInvalidError(error)) && hasRequiredTwoFactorMethod(error) && this.twoFactorHandler) {
				const method2fa = 'details' in error ? error.details.method : 'password';

				const code = await this.twoFactorHandler({
					method: method2fa,
					emailOrUsername: error.details.emailOrUsername,
					invalidAttempt: isTotpInvalidError(error),
				});

				return this.send(endpoint, method, {
					...options,
					headers: {
						...this.getCredentialsAsHeaders(),
						...this.headers,
						...headers,
						'x-2fa-code': code,
						'x-2fa-method': method2fa,
					},
				});
			}

			return Promise.reject(response);
		});
	}

	protected getParams(data: Record<string, object | number | string | boolean> | void): string {
		return data ? stringify(data, { arrayFormat: 'bracket' }) : '';
	}

	upload: RestClientInterface['upload'] = (endpoint, params, events, options = {}) => {
		console.log('Params received:', params);
		if (!params) {
			throw new Error('Missing params');
		}
		const xhr = new XMLHttpRequest();
		const data = new FormData();

		// if(params.file[0] instanceof File) {
		// 	console.log('File object found. Appending with name:', params.file[0].name);
		// 	data.append('file', params.file[0], params.file[0].name);
		// 	console.log("data from single file testing ", data);
		// }
		// if(params.file[1] instanceof File) {
		// 	console.log('File object found. Appending with name:', params.file[1].name);
		// 	data.append('file', params.file[0], params.file[1].name);
		// 	console.log("data from single file testing ", data);
		// }

		Object.entries(params as any).forEach(([key, value]) => {
			console.log('Processing parameter:', key, 'with value:', value);
			if (Array.isArray(value)) {
				console.log('Array found. Appending as JSON string:', value);
				// Convert the array to JSON and append it
				// data.append(key, JSON.stringify(value));

				value.forEach((file) => {
					console.log('Appending item:', file, 'with name:', file.name);
					data.append(key, file, file.name);
				});

				// if done data.append(file.name,key); than it comes like
				// bda 123 Abhi.pdf: (binary)
				// bda 132.pdf: (binary)
				// bda 139 dhruv.pdf: (binary)

				// value.forEach((item) => {
				// 	data.append(key, item,item.name);
				// })
			} else if (value instanceof File) {
				console.log('File object found. Appending with name:', value.name);
				// If it's a File object, append it with its name
				data.append(key, value, value.name);
			} else {
				console.log('Appending value as is:', value);
				// For non-array and non-file values
				value && data.append(key, value as any);
			}
		});
		// data.append("data", "test");
		console.log('Sending FormData object:', data);
		for (var ans of data.entries()) {
			console.log('field one ' + ans[0] + ' filed ' + ans[1]);
		}

		console.log('this is baseurl from index.ts', this.baseUrl);
		console.log('this coplete url from index.ts api-client' + `${this.baseUrl}${`/${endpoint}`.replace(/\/+/, '/')}`);

		xhr.open('POST', `${this.baseUrl}${`/${endpoint}`.replace(/\/+/, '/')}`, true);
		Object.entries({ ...this.getCredentialsAsHeaders(), ...options.headers }).forEach(([key, value]) => {
			console.log('xhr for from getuploadformData key ' + key + ' value ' + value);
			xhr.setRequestHeader(key, value);
		});

		if (events?.load) {
			console.log('load from index.ts in api-client');
			xhr.upload.addEventListener('load', events.load);
		}
		if (events?.progress) {
			console.log('progress from index.ts in api-client');
			xhr.upload.addEventListener('progress', events.progress);
		}
		if (events?.error) {
			console.log('error from index.ts in api-client');
			xhr.addEventListener('error', events.error);
		}
		if (events?.abort) {
			console.log('abort from index.ts in api-client');
			xhr.addEventListener('abort', events.abort);
		}

		xhr.send(data);

		return xhr;
	};

	// upload: RestClientInterface['upload'] = (endpoint, params, events, options = {}) => {
	// 	console.log(params);
	// 	if (!params) {
	// 		throw new Error('Missing params');
	// 	}
	// 	const xhr = new XMLHttpRequest();
	// 	const data = new FormData();

	// 	Object.entries(params as any).forEach(([key, value]) => {
	// 		if (Array.isArray(value)) {
	//     console.log("from api-client" + value);

	//     // Assuming each value in the array is a File object
	//     // value.forEach(file => {
	// 	const file = value;
	//     data.append(key, file, file.name);
	//     // });
	// } else if (value instanceof File) {
	//     data.append(key, value, value.name);
	// } else {
	//     // For non-array and non-file values
	//     value && data.append(key, value as any);

	// 		// if(Array.isArray(value)) {
	// 		// 	console.log("from api-client"+value);

	// 		// }
	// 		// // if (value instanceof File) {
	// 		// // 	data.append(key, value, value.name);
	// 		// // 	return;
	// 		// // }
	// 		// value && data.append(key, value as any);
	// 	}
	// });

	// 	xhr.open('POST', `${this.baseUrl}${`/${endpoint}`.replace(/\/+/, '/')}`, true);
	// 	Object.entries({ ...this.getCredentialsAsHeaders(), ...options.headers }).forEach(([key, value]) => {
	// 		xhr.setRequestHeader(key, value);
	// 	});

	// 	if (events?.load) {
	// 		xhr.upload.addEventListener('load', events.load);
	// 	}
	// 	if (events?.progress) {
	// 		xhr.upload.addEventListener('progress', events.progress);
	// 	}
	// 	if (events?.error) {
	// 		xhr.addEventListener('error', events.error);
	// 	}
	// 	if (events?.abort) {
	// 		xhr.addEventListener('abort', events.abort);
	// 	}

	// 	xhr.send(data);

	// 	return xhr;
	// };

	use(middleware: Middleware<RestClientInterface['send']>): void {
		const fn = this.send.bind(this);
		this.send = function (this: RestClient, ...context: Parameters<RestClientInterface['send']>): ReturnType<RestClientInterface['send']> {
			return middleware(context, pipe(fn));
		} as RestClientInterface['send'];
	}

	handleTwoFactorChallenge(
		cb: (args: { method: 'totp' | 'email' | 'password'; emailOrUsername?: string; invalidAttempt?: boolean }) => Promise<string>,
	): void {
		this.twoFactorHandler = cb;
	}
}
