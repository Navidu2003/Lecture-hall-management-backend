import mongoose from "mongoose";

const lectureHallSchema = new mongoose.Schema(
    {
        name: { 
            type: String, 
            required: true
         },
        capacity: { 
            type: Number, 
            required: true 
        }
});

const LectureHall = mongoose.model("LectureHall", lectureHallSchema);
export default LectureHall;