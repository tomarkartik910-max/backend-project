import {asyncHandler} from "../utils//asyncHandler.js"
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.model.js"   //User can directly communicate with the mongoDB
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { application } from "express"


const generateAccessAndRefreshTokens = async(userId)=>{
    try {
        const user =  await User.findById(userId)
        //console.log(user);
        
        const accessToken=user.generateAccessToken()
        //console.log(accessToken);
        
        const refreshToken=user.generateRefreshToken()
        //console.log("refreshToken is here",refreshToken);
        

        //putting refresh token in database
        user.refreshToken=refreshToken
        await user.save({validateBeforeSave:false})  //while saving the models triggered and thus might ask for the validity but i know what am i doing so i jump off those validation

        return {accessToken,refreshToken}

    } catch (error) {
        console.log(error)
        throw new ApiError(500,"Something went wrong while generating access and refresh token")
    }
}

const registerUser = asyncHandler (async (req,res) => {
    // res.status(200).json({
    //     message:"chai aur code"
    // })
    // console.log("Controller reached")

    //before writing the controller it is good practice to write the steps 

    //get user details from backend
    //validation -- not empty
    //check if user already exists:username , email
    //check for images,check for avatar
    //upload them to cloudinary , avatar
    //create user object - create entry in db
    //remove password and refresh token field from response
    //check for user reaction
    //return res

    const {fullName,email,username,password} = req.body
    //console.log("email:",email);

    // if(fullName === ""){
    //     throw new ApiError(400,"fullname is required")
    // }       --  we can check for each field similarly with the if block but we have an alternate

    if(
        [fullName,email,username,password].some((field) => field?.trim() === "")
    ){
        throw new ApiError(400,"All fields are required")
    }

    //User.findOne({email})  -- we can check with this for the existing user but we write it in better way
    const existedUser=await User.findOne({
        $or:[{username},{email}]  //here we can write as many field as we want
    })

    if(existedUser){
        throw new ApiError(409,"User with email or username already exists")
    }

    //req.body(by express) -- gives us most of the data
    //req.files (by multer middleware) -- gives us the access of the file

    const avatarLocalPath=req.files?.avatar[0]?.path;   //localpath because it is on our server not on the cloudinary
    //const coverImageLocalPath=req.files?.coverImage[0]?.path;  //this throws error if we send data without the coverimage although the coverimage is not required field but here we check conditionally and we still cant check conditionally from the undefined


    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length>0){
        coverImageLocalPath=req.files.coverImage[0].path
    }

    //console.log(req.files)
    //console.log(req.body)

    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is required")
    }
    //console.log(avatarLocalPath);
    //console.log(coverImageLocalPath);

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
        new ApiResponse(200,createdUser,"User registered Successfully")
    )

})

const loginUser = asyncHandler(async (req,res) =>{
    //steps for this controller

    //req body -> gives data
    //access on basis of username or email
    //find the user
    //password check 
    //access token and refresh token generate 
    //send cookie

    const {email,username,password} = req.body
    //console.log(req.body)
    if(!(username || email)){
        throw new ApiError(400,"username or password is required")
    }

    const user = await User.findOne({
        $or : [{username},{email}]
    })

    if(!user){
        throw new ApiError(404,"User does not exist")
    }
    //console.log(password);
    
    const isPasswordValid = await user.isPasswordCorrect(password)

    if(!isPasswordValid){
        throw new ApiError(401,"Invalid user credentials")
    }

    //generating the access token -- it is common task so creating a separate method for this
    const {accessToken,refreshToken} = await generateAccessAndRefreshTokens(user._id)

    //send these tokens in secure cookie to user
    const loggedInUser = await User.findById(user._id).
    select("-password -refreshToken")

    const options = {
        httpOnly: true, 
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedInUser,accessToken,
                refreshToken
            },
            "User loggid In Successfully"
        )
    )


})

const logoutUser = asyncHandler(async(req,res) =>{
    //remove cookie and remove tokens
    //for this controller we create our custom middleware
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                refreshToken:undefined
            }
        },
        {
            new:true
        }
    )

    const options = {
        httpOnly: true, 
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(new ApiResponse(200,{},"User logged Out"))
})

export default registerUser
export {
    loginUser,
    logoutUser
}