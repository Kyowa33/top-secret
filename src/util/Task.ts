

enum TaskStatus {
    WAITING = 0,
    RUNNING
};


abstract class TaskState {
    public runInc: CallableFunction;
    public onUpdate: CallableFunction;
    public onSuccess: CallableFunction;
    public onError: CallableFunction;

    public constructor (runInc : CallableFunction, onUpdate: CallableFunction, onSuccess: CallableFunction, onError: CallableFunction) {
        this.runInc = runInc;
        this.onUpdate = onUpdate;
        this.onSuccess = onSuccess;
        this.onError = onError;
    }
}

abstract class Task {

    public static LOG = false;

    public static s_taskInstanceCounter = 0;
    public taskInstanceNumber = Task.s_taskInstanceCounter++;

    private taskStatus: TaskStatus = TaskStatus.WAITING;
    private incObj: TaskState;

    private MIN_DELAY = 5;
    private DEFAULT_TIME_FRAME = 100; // ms
    private DEFAULT_TIME_RATE = 0.8; // 80% of time used for this task
    private timeFrame = this.DEFAULT_TIME_FRAME;
    private taskTimeFrame = 0;
    private timeOutHandle : string | number | NodeJS.Timeout | undefined;

    constructor(_timeFrame?, _timeRate?) {
        this.timeFrame = _timeFrame || this.DEFAULT_TIME_FRAME;
        let timeRate = _timeRate || this.DEFAULT_TIME_RATE;
        this.taskTimeFrame = this.timeFrame * timeRate;
    }

    public setTimeRate(_timeRate) {
        this.taskTimeFrame = this.timeFrame * _timeRate;
    }

    public isRunning() : boolean {
        return this.taskStatus === TaskStatus.RUNNING;
    }


    private launchRun(remainingTimeInFrame? : number | undefined) : void {
        if (Task.LOG) console.log("inst " + this.taskInstanceNumber + " ; launchRun");
        this.killRun();
        this.timeOutHandle = setTimeout(() => this.runIncrementalInternal(), (remainingTimeInFrame !== undefined) ? remainingTimeInFrame : this.MIN_DELAY);
        if (Task.LOG) console.log("inst " + this.taskInstanceNumber + " ; setTimeout " + this.timeOutHandle);
    }

    private killRun() : void {
        if (this.timeOutHandle !== undefined) {
            if (Task.LOG) console.log("inst " + this.taskInstanceNumber + " ; clearTimeout " + this.timeOutHandle);
            clearTimeout(this.timeOutHandle);
            this.timeOutHandle = undefined;
        }
    }


    public start(_incObj: TaskState) : void {
        
        if (this.isRunning()) {
            if (Task.LOG) console.log("inst " + this.taskInstanceNumber + " ; Task Start : is already running");
            return;
        }

        if (Task.LOG) console.log("inst " + this.taskInstanceNumber + " ; Task Start");
        this.incObj = _incObj;
        this.taskStatus = TaskStatus.RUNNING;
        this.launchRun();
    }

    public stop() : void {
        this.taskStatus = TaskStatus.WAITING;
        this.killRun();
        if (Task.LOG) console.log("inst " + this.taskInstanceNumber + " ; Task Stop");
    }


    protected getIncObj() : TaskState {
        return this.incObj;
    }


    public runIncrementalInternal() : void {
        if (!this.isRunning()) {
            if (Task.LOG) console.log("inst " + this.taskInstanceNumber + " ; Task interrupted");
            return;
        }

        let currentTimeStart = Date.now();
        let currentTimeEnd;
        if (Task.LOG) console.log("inst " + this.taskInstanceNumber + " ; runIncrementalInternal start : " + currentTimeStart);
        let spentTime = 0;
        let breakThisLoop = false;
        do {
            breakThisLoop = this.incObj.runInc();
            currentTimeEnd = Date.now();
            spentTime = currentTimeEnd - currentTimeStart;
        } while ((this.isRunning()) && (!breakThisLoop) && (spentTime < this.taskTimeFrame));

        if (Task.LOG) console.log("inst " + this.taskInstanceNumber + " ; runIncrementalInternal end / spentTime : " + currentTimeEnd + " / " + spentTime);
        if (this.isRunning()) {
            let remainingTimeInFrame = Math.max(this.MIN_DELAY, this.timeFrame - spentTime);
            this.launchRun(remainingTimeInFrame);
        } else {
            if (Task.LOG) console.log("inst " + this.taskInstanceNumber + " ; Task terminated");
        }
    }

}


export {Task,TaskState};