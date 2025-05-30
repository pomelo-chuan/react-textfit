/**
 * Run the functions in the tasks array in series, each one running once the previous function has completed.
 * If any functions in the series pass an error to its callback, no more functions are run,
 * and callback is immediately called with the value of the error. Otherwise, callback receives an array of results
 * when tasks have completed.
 * Taken from https://github.com/feross/run-series
 *
 * @params {Array} tasks An array containing functions to run, each function is passed a callback(err, result) which it must call on completion with an error err (which can be null) and an optional result value.
 * @params {Function} callback(err, results) - An optional callback to run once all the functions have completed. This function gets a results array containing all the result arguments passed to the task callbacks.
 */

type TaskCallback = (err: any, result?: any) => void;
type Task = (callback: TaskCallback) => void;
type SeriesCallback = (err: any, results?: any[]) => void;

export default function series(tasks: Task[], cb?: SeriesCallback): void {
    const results: any[] = [];
    let current = 0;
    let isSync = true;

    function done(err: any): void {
        function end() {
            if (cb) cb(err, results);
        }
        if (isSync) setTimeout(end, 0);
        else end();
    }

    function each(err: any, result?: any): void {
        results.push(result);
        if (++current >= tasks.length || err) done(err);
        else tasks[current](each);
    }

    if (tasks.length > 0) tasks[0](each);
    else done(null);

    isSync = false;
} 