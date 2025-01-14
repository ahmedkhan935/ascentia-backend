const TutorProfile = require('../../models/Tutor');

const tutorController = {
    create: async (req, res) => {
        try {
            const { email, password, firstName, lastName, phone, subjects, qualifications, defaultSchedule } = req.body;

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

            // Create tutor profile
            const tutorProfile = new TutorProfile({
                user: newTutor._id,
                subjects,
                qualifications,
                defaultSchedule
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
            const { subjects, qualifications, defaultSchedule } = req.body;

            const tutorProfile = await TutorProfile.findOneAndUpdate(
                { user: req.params.id },
                { subjects, qualifications, defaultSchedule },
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
    }
};

module.exports = tutorController;