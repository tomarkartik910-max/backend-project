import {asyncHandler} from "../utils//asyncHandler.js"
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.model.js"   //User can directly communicate with the mongoDB
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"


const registerUser = asyncHandler (async (req,res) => {
    // res.status(200).json({
    //     message:"chai aur code"
    // })


    //before writing the controller it is good practice to write the steps 

    //get user details from backend
    //validation -- not empty
    //check if user already exists:username , email
    //check for images,check for avatar
    //upload them to cloudinary , avatar
    //create user object - create entry in db
    //remove password and refresh token field from response
    //checl for user reaction
    //return res

    const {fullName,email,username,password} = req.body
    console.log("email:",email);

    // if(fullName === ""){
    //     throw new ApiError(400,"fullname is required")
    // }       --  we can check for each field similarly with the if block but we have an alternate

    if(
        [fullName,email,username,password].some((field) => field?.trim() === "")
    ){
        throw new ApiError(400,"All fields are required")
    }

    //User.findOne({email})  -- we can check with this for the existing user but we write it in better way
    const existedUser=username.findOne({
        $or:[{username},{email}]  //here we can write as many field as we want
    })

    if(existedUser){
        throw new ApiError(409,"User with email or username already exists")
    }

    //req.body(by express) -- gives us most of the data
    //req.files (by multer middleware) -- gives us the access of the file

    const avatarLocalPath=req.files?.avatar[0]?.path;   //localpath because it is on our server not on the cloudinary
    const coverImageLocalPath=req.files?.coverImage[0]?.path;

    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is required")
    }

    const avatar=await uploadOnCloudinary(avatarLocalPath) //this await is the reason we made this with the async
    const coverImage=await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar){
        throw new ApiError(400,"Avatar file is required")
    }

    const user = await User.create({   //2 rules of db , error handles with catch exist in the asynchandler util and we put await as this can take time
        fullName,
        avatar:avatar.url,
        coverImage:coverImage?.url||"",  //as we dont compulsory to upload coverimage so url may not be exist thereby we enter its url if exist
        email,
        password,
        username:username.toLowerCase()
    })

    const createdUser=await User.findById(user._id).select(
        "-password -refreshToken"    //take care of syntax here
    )

    if(!createdUser){
        throw new ApiError(500,"Something went wrong while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(200,createdUse,"User registered Successfully")
    )

})

export default registerUser