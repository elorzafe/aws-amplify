'use strict';

import { jitteredExponentialRetry, NonRetryableError } from '../src/Util';
import { ConsoleLogger as Logger } from '../src/Logger';
Logger.LOG_LEVEL = 'DEBUG';
describe('Util', () => {
	beforeEach(() => {
		jest.useFakeTimers();
		jest.clearAllMocks();
	});

	test('jitteredExponential retry happy case', done => {
		const resolveAt = 3;
		function createRetryableFunction() {
			let attempt = 1;
			return () => {
				return new Promise((res, rej) => {
					if (attempt >= resolveAt) {
						res('done');
					} else {
						attempt++;
						rej('try again...');
					}
				});
			};
		}

		const spyableObject = {
			spyableFunction: createRetryableFunction(),
		};

		const spy = jest.spyOn(spyableObject, 'spyableFunction');
		expect.assertions(1);

		try {
			jitteredExponentialRetry(spyableObject.spyableFunction, []).then(done);
		} catch (err) {}
		jest.runAllTimers();
		expect(spy).toHaveBeenCalledTimes(3);
	});
	test('Fail with NonRetryableError', async () => {
		const isNonRetryableError = (obj: any): obj is NonRetryableError =>
			obj instanceof NonRetryableError;
		const nonRetryableError = new NonRetryableError('fatal error');
		isNonRetryableError(nonRetryableError)
			? console.log('non retry')
			: console.log('retry');
		console.log(nonRetryableError.constructor.name);
		const testFunc = jest.fn(() => {
			throw nonRetryableError;
		});
		expect.assertions(1);

		try {
			await jitteredExponentialRetry(testFunc, []);
		} catch (err) {
			// expect(err).toBe(nonRetryableError);
		}
		expect(testFunc).toBeCalledTimes(1);
	});
});
