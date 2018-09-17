const AWS = require('aws-sdk');
const fp = require('lodash/fp');
const mongoose = require('mongoose');
const multer = require('multer');
const multerS3 = require('multer-s3');

const getObjectId = id => mongoose.Types.ObjectId(id);

const getS3ObjectKey = fp.pipe([
  fp.get('originalname'),
  originalname => `${getObjectId()}/${originalname}`,
]);

const keyToObjectId = fp.pipe([
  fp.split('/'),
  fp.head,
  getObjectId,
]);

const assignObjectId = file => (
  fp.pipe
    ([
      fp.get('key'),
      keyToObjectId,
      objectId => ({ objectId }),
      fp.assign(file),
    ])
    (file)
);

const validateFile = fp.cond([
  [fp.negate(fp.identity), fp.stubFalse],
  [fp.negate(fp.get('key')), fp.stubFalse],
  [fp.stubTrue, fp.stubTrue],
]);

const objectIdMiddleware = (req, res, next) => {
  fp.pipe
    ([
      fp.get('file'),
      fp.cond([[validateFile, assignObjectId]]),
    ])
    (req);

  next();
};

const getStorageEngine = accessKeyId => secretAccessKey => bucket => {
  const acl = 'private';

  const contentType = (req, file, cb) => {
    cb(null, fp.get('mimetype')(file));
  };

  const key = (req, file, cb) => {
    cb(null, getS3ObjectKey(file));
  };

  const s3 = new AWS.S3({
    accessKeyId,
    secretAccessKey,
  });

  return multerS3({
    acl,
    bucket,
    contentType,
    key,
    s3,
  });
};

module.exports.getRouter = accessKeyId => secretAccessKey => bucket => {
  const storage = getStorageEngine
    (accessKeyId)
    (secretAccessKey)
    (bucket);

  const router = require('express').Router();

  router.post(
    '*',
    multer({ storage }).single('file'),
    objectIdMiddleware
  );

  return router;
};

module.exports.getSignedUrl = accessKeyId => secretAccessKey => Bucket => Expires => Key => {
  const s3 = new AWS.S3({
    accessKeyId,
    secretAccessKey,
  });

  const params = {
    Bucket,
    Key,
    Expires,
  };

  return s3.getSignedUrl('getObject', params);
};
