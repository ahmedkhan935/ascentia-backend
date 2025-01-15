const TutorProfile = require('../../models/Tutor');
const Bonus = require('../../models/Bonus');
const User = require('../../models/User');
const createLog = require('../../middleware/logger').createLog;

const bcrypt = require('bcryptjs');
const tutorController = {
    create: async (req, res) => {
        try {
            const { email, password, firstName, lastName, phone, subjects, qualifications, shifts } = req.body;

            // Create user account
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            const newTutor = new User({
                email,
                password: hashedPassword,
                role: 'tutor',
                firstName,
                lastName,
                phone
            });


            await newTutor.save();
   
            const tutorProfile = new TutorProfile({
                user: newTutor._id,
                subjects,
                qualifications,
                shifts
            });

            await tutorProfile.save();

            await createLog('CREATE', 'TUTOR', newTutor._id, req.user, req);

            res.status(201).json({
                message: 'Tutor created successfully',
                tutor: {
                    _id: newTutor._id,
                    email: newTutor.email,
                    firstName: newTutor.firstName,
                    lastName: newTutor.lastName,
                    profile: tutorProfile
                }
            });
        } catch (error) {
            res.status(500).json({ message: 'Error creating tutor', error: error.message });
        }
    },

    getAll: async (req, res) => {
        try {
            const tutors = await TutorProfile.find()
                .populate('user', '-password');
            
            await createLog('READ', 'TUTOR', null, req.user, req);

            res.json(tutors);
        } catch (error) {
            res.status(500).json({ message: 'Error fetching tutors', error: error.message });
        }
    },

    getById: async (req, res) => {
        try {
            const tutor = await TutorProfile.findOne({ user: req.params.id })
                .populate('user', '-password');

            if (!tutor) {
                return res.status(404).json({ message: 'Tutor not found' });
            }

            await createLog('READ', 'TUTOR', tutor._id, req.user, req);

            res.json(tutor);
        } catch (error) {
            res.status(500).json({ message: 'Error fetching tutor', error: error.message });
        }
    },

    update: async (req, res) => {
        try {
            const { subjects, qualifications, defaultSchedule,assignedBlogs,publishedBlogs } = req.body;
            
            const updateData = {};
            if (subjects) updateData.subjects = subjects;
            if (qualifications) updateData.qualifications = qualifications;
            if (defaultSchedule) updateData.defaultSchedule = defaultSchedule;
            if(assignedBlogs) updateData.assignedBlogs = assignedBlogs;
            if(publishedBlogs) updateData.publishedBlogs = publishedBlogs;
            const tutorProfile = await TutorProfile.findOneAndUpdate(
                { user: req.params.id },
                updateData,
                { new: true }
            
            ).populate('user', '-password');

            if (!tutorProfile) {
                return res.status(404).json({ message: 'Tutor not found' });
            }

            await createLog('UPDATE', 'TUTOR', tutorProfile._id, req.user, req);

            res.json({
                message: 'Tutor updated successfully',
                tutor: tutorProfile
            });
        } catch (error) {
            res.status(500).json({ message: 'Error updating tutor', error: error.message });
        }
    },

    delete: async (req, res) => {
        try {
            // Delete tutor profile
            const tutorProfile = await TutorProfile.findOneAndDelete({ user: req.params.id });
            if (!tutorProfile) {
                return res.status(404).json({ message: 'Tutor not found' });
            }

            // Delete user account
            await User.findByIdAndDelete(req.params.id);

            await createLog('DELETE', 'TUTOR', tutorProfile._id, req.user, req);

            res.json({ message: 'Tutor deleted successfully' });
        } catch (error) {
            res.status(500).json({ message: 'Error deleting tutor', error: error.message });
        }
    },
    addShift : async (req, res) => {
        try {
            const  tutorId  = req.params.id;
            const { shift } = req.body;
            console.log(shift);
            console.log(tutorId);
            if(!shift.dayOfWeek || !shift.startTime || !shift.endTime) {
                return res.status(400).json({ message: 'Please provide day of week, start time and end time' });
            }
            const tutor = await TutorProfile.findOne({ user: tutorId });
            if (!tutor) {
                return res.status(404).json({ message: 'Tutor not found' });
            }
            tutor.shifts.push(shift);
            await tutor.save();
            res.json({ message: 'Shift added successfully' });
        } catch (error) {
            res.status(500).json({ message: 'Error adding shift', error: error.message });
        }
    },
    removeShift : async (req, res) => {
        try {
            const  tutorId  = req.params.id;
            const {  shiftId } = req.body;
            const tutor = await TutorProfile.findOne({ user: tutorId });
            if (!tutor) {
                return res.status(404).json({ message: 'Tutor not found' });
            }
            tutor.shifts = tutor.shifts.filter(shift => shift._id.toString() !== shiftId);
            await tutor.save();
            res.json({ message: 'Shift removed successfully' });
        } catch (error) {
            res.status(500).json({ message: 'Error removing shift', error: error.message });
        }
    },
    getShift : async (req, res) => {
        const  tutorId  = req.params.id;
        const day = req.query.day;
      
        const tutor = await TutorProfile.findOne({ user: tutorId });
        if (!tutor) {
            return res.status(404).json({ message: 'Tutor not found' });
        }
        let shift;
        shift = tutor.shifts;
        if(day){
             shift = tutor.shifts.find(s => s.dayOfWeek === day);
        }
        
        return res.json(shift);
    },
    AddBonus : async (req, res) => {
        try {
            const { tutorId, bonus } = req.body;
            if(!bonus.amount || !bonus.reason) {
                return res.status(400).json({ message: 'Please provide amount and reason' });
            }
            const tutor = await TutorProfile.findOne({ user: tutorId });
            if (!tutor) {
                return res.status(404).json({ message: 'Tutor not found' });
            }
            const newBonus = new Bonus ({
                user: tutor.user,
                username: tutor.user.firstName + ' ' + tutor.user.lastName,
                bonus: bonus.amount,
                description: bonus.reason
            });
            await newBonus.save();
            
            
            res.json({ message: 'Bonus added successfully' });
        } catch (error) {
            res.status(500).json({ message: 'Error adding bonus', error: error.message });
        }
    },
    getBonus : async (req, res) => {
        const { tutorId } = req.params;
        const tutor = await TutorProfile.findOne({ user: tutorId });
        if (!tutor) {
            return res.status(404).json({ message: 'Tutor not found' });
        }
        const bonuses = await Bonus.find({ user: tutor.user });
        return res.json(bonuses);
    },
    getBonusById : async (req, res) => {
        const { tutorId, bonusId } = req.params;
        const tutor = await TutorProfile.findOne({ user: tutorId });
        if (!tutor) {
            return res.status(404).json({ message: 'Tutor not found' });
        }
        const bonus = await Bonus.findById(bonusId);
        return res.json(bonus);
    },
    getBonusByUser : async (req, res) => {
        const { userId } = req.params;
        const bonuses = await Bonus.find({ user: userId });
        return res.json(bonuses);
    },
    removeBonus : async (req, res) => {
        try {
            const { tutorId, bonusId } = req.body;
            const tutor = await TutorProfile.findOne({ user: tutorId });
            if (!tutor) {
                return res.status(404).json({ message: 'Tutor not found' });
            }
            await Bonus.findByIdAndDelete(bonusId);
            res.json({ message: 'Bonus removed successfully' });
        } catch (error) {
            res.status(500).json({ message: 'Error removing bonus', error: error.message });
        }
    },
    updateBonus : async (req, res) => {
        try {
            const { tutorId, bonusId, bonus } = req.body;
            if(!bonus.amount || !bonus.reason) {
                return res.status(400).json({ message: 'Please provide amount and reason' });
            }
            const tutor = await TutorProfile.findOne({ user: tutorId });
            if (!tutor) {
                return res.status(404).json({ message: 'Tutor not found' });
            }
            await Bonus.findByIdAndUpdate(bonusId, { bonus: bonus.amount, description: bonus.reason });
            res.json({ message: 'Bonus updated successfully' });
        } catch (error) {
            res.status(500).json({ message: 'Error updating bonus', error: error.message });
        }
    },






    

    
};

module.exports = tutorController;