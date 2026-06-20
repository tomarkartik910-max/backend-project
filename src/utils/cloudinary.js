import {v2 as cloudinary} from "cloudinary"
import fs, { unlink } from "fs"
import dotenv from "dotenv";

dotenv.config();

//console.log(process.env.CLOUDINARY_API_KEY);

cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET 
});

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if(!localFilePath) return null
        //upload the file on cloudinary
        const response = await cloudinary.uploader.upload(localFilePath,{
            resource_type:"auto"
        })
        //console.log("response is here",response)
        //file has been uploaded successfully
        //console.log("file is uploaded on cloudinary",response.url);
        fs.unlinkSync(localFilePath)
        return response;
    } catch (error) {
        //console.log(error)
        fs.unlinkSync(localFilePath)    //remove the locally saved temporary file as the upload operation got failed so that there would be no malicious file in our file system
        return null;
    }
}

export {uploadOnCloudinary}
