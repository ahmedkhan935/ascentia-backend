// utils/timeUtils.js

/**
 * Checks if two time ranges overlap.
 * @param {string} startTime1 - Start time of the first range in HH:MM format.
 * @param {string} endTime1 - End time of the first range in HH:MM format.
 * @param {string} startTime2 - Start time of the second range in HH:MM format.
 * @param {string} endTime2 - End time of the second range in HH:MM format.
 * @returns {boolean} - Returns true if the time ranges overlap, otherwise false.
 */
function timeRangeOverlap(startTime1, endTime1, startTime2, endTime2) {
    const [startHour1, startMinute1] = startTime1.split(':').map(Number);
    const [endHour1, endMinute1] = endTime1.split(':').map(Number);
    const [startHour2, startMinute2] = startTime2.split(':').map(Number);
    const [endHour2, endMinute2] = endTime2.split(':').map(Number);

    const start1 = startHour1 * 60 + startMinute1;
    const end1 = endHour1 * 60 + endMinute1;
    const start2 = startHour2 * 60 + startMinute2;
    const end2 = endHour2 * 60 + endMinute2;

    return (start1 < end2 && end1 > start2);
}

module.exports = { timeRangeOverlap };