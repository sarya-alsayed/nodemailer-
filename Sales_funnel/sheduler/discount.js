/**
 * Created by dailcoyote on 8/18/16.
 */
var Q = require('q');

function DiscountPlanner(schedule, landingStore, systemStore){
    this.schedule = schedule;
    this.landing_store = landingStore;
    this.system_store = systemStore;
    this.jobs = new Map();
}

DiscountPlanner.JOB_STATUSES = {
    DISCOUNT_ON: '1',
    DISCOUNT_OFF: '2'
};

DiscountPlanner.prototype.jobCount = function () {
    return this.jobs.size;
};

DiscountPlanner.prototype.searchKeyJob = function (compareKey) {
    for (var jobKey of this.jobs.keys()) {
        if(compareKey.landing_class == jobKey.landing_class
            && compareKey.landing_themeId == jobKey.landing_themeId
            && compareKey.job_status == jobKey.job_status){
            return jobKey;
        }
    }
    return false;
};

DiscountPlanner.prototype.takeSheduleJob = function (status, taskTime, landing) {
    var key = {
        landing_class: landing.landing_class,
        landing_themeId : landing.landing_theme,
        job_status: status
    };
    console.log("INFO: DiscountPlanner take a new Job Parameter=>", key);
    this.jobs.set(key, this.schedule.scheduleJob(taskTime, this.onShedule.bind(this, status, landing)));
};

DiscountPlanner.prototype.deleteJob = function (type, status, job) {
    var defer = Q.defer();
    job["job_status"] = status;
    this.jobs.delete(job);
    job["shedule_type"] = type;

    this.system_store.removeDoc("LandingSchedule", job)
        .then(defer.resolve.bind(defer, true))
        .catch(defer.reject.bind(defer));

    return defer.promise;
};

DiscountPlanner.prototype.onShedule = function (status, landing) {
    var landingClass = landing.landing_class,
        landingThemeId = landing.landing_theme;

    if(status == DiscountPlanner.JOB_STATUSES.DISCOUNT_ON){
        landing.options.sale.discount.active = true;
    }
    else if(status == DiscountPlanner.JOB_STATUSES.DISCOUNT_OFF){
        delete landing.options.sale.discount;
    }

    console.log("INFO: DiscountPlanner is active! Turn On Discount of the Landing=>",
        JSON.stringify(landing));
    this.landing_store
        .updateLandingOptions(landingClass, landingThemeId, landing.options)
        .then(function () {
            if(status == DiscountPlanner.JOB_STATUSES.DISCOUNT_OFF){
                return this.onRemoveDiscount({
                    landing_class: landingClass,
                    landing_themeId: landingThemeId,
                    job_status: status
                })
            }
        }.bind(this))
        .then(console.log.bind(console, "INFO: Discount Shedule JOB Finish!"))
        .catch(console.error.bind(console)); // TODO: need transfer to exception handler


};
DiscountPlanner.prototype.onRemoveDiscount = function (doc) {
    var defer = Q.defer();
    Q.spread([
        this.deleteJob("discount", DiscountPlanner.JOB_STATUSES.DISCOUNT_ON, doc),
        this.deleteJob("discount", DiscountPlanner.JOB_STATUSES.DISCOUNT_OFF, doc)
    ], defer.resolve.bind(defer), defer.reject.bind(defer));
    return defer.promise;
};


exports.DiscountPlanner = DiscountPlanner;