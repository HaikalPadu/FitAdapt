class AppError extends Error {constructor(status,code,message){super(message);Object.assign(this,{status,code});}}
const fail=(status,code,message)=>{throw new AppError(status,code,message);};
function errors(err,req,res,next){
 if(err.type==='entity.parse.failed')return res.status(400).json({error:{code:'INVALID_JSON',message:'Format permintaan tidak sah.'}});
 if(err.type==='entity.too.large')return res.status(413).json({error:{code:'PAYLOAD_TOO_LARGE',message:'Permintaan terlalu besar.'}});
 if(err.name==='ZodError')return res.status(422).json({error:{code:'VALIDATION_ERROR',message:'Sila semak maklumat yang dimasukkan.',fields:err.issues.map(i=>({field:i.path.join('.'),message:i.message}))}});
 if(/UNIQUE constraint|Duplicate entry/.test(err.message))return res.status(409).json({error:{code:'DUPLICATE',message:'Rekod ini telah wujud. Gunakan e-mel atau nama yang berbeza.'}});
 if(!err.status)console.error(err);
 res.status(err.status||500).json({error:{code:err.code||'INTERNAL_ERROR',message:err.status?err.message:'Ralat pelayan. Sila cuba lagi.'}});
}
module.exports={AppError,fail,errors};
