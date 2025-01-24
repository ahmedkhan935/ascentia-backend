const mongoose = require('mongoose');
const Class = require('../../models/Class');
const User = require('../../models/User');


const ClassController = {
    async createClass(req, res) {
        try {
            const { type, subject, price, tutor, students,startDate,endDate,startTime,endTime, } = req.body;
            const newClass = new Class({
                type,
                subject,
                price,
                tutor,
                students
            });
            const savedClass = await newClass.save();
            res.status(201).json(savedClass);
        }
        catch (error) {
            res.status(400).json({ message: error.message });
        }
    }
};
