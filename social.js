var social_oids=[];
var social_info={};
var sbook_allechoes=[];
var sbook_echoes_by_pingid={};
var sbook_echoes_by_user={};
var sbook_echoes_by_tags={};
var sbook_echoes_by_distribution={};
var sbook_echoes_by_id={};

function importSocialData(data)
{
  if ((!(data)) && (sbook_echoes_data))
    data=sbook_echoes_data;
  var info=data['%info'];
  if ((info) && (info.length)) {
    var i=0; while (i<info.length) {
      var item=info[i++];
      fdjtLog("item=%o oid=%o",item,item.OID);
      social_info[item.OID]=item;
      social_oids.push(item.OID);}}
  var ids=data['%ids'];
  if ((ids) && (ids.length)) {
    var i=0; while (i<ids.length) {
      var id=ids[i++];
      var entries=data[id];
      var j=0; while (j<entries.length) {
	var entry=entries[j++];
	var pingid=entry.pingid;
	var user=entry.user;
	var item=sbook_echoes_by_pingid[pingid];
	if (!(item)) {
	  sbook_allechoes.push(entry);
	  item=entry;}
	fdjtAdd(sbook_echoes_by_id,id,item);
	if (entry.tags) {
	  var tags=entry.tags;
	  var i=0; while (i<tags.length) {
	    var tag=tags[i++];
	    if (item!=entry) fdjtAdd(item,'tags',tag,true);
	    fdjtAdd(sbook_echoes_by_tag,tag,item);}}
	if (entry.distribution) {
	  var distribution=entry.distribution;
	  var i=0; while (i<distributio.length) {
	    var dist=distribution[i++];
	    if (item!=entry) fdjtAdd(item,'tags',tag,true);
	    fdjtAdd(sbook_echoes_by_distribution,dist,item);}}
	if (entry.user) {
	  if (item!=entry) item.user=user;
	  fdjtAdd(sbook_echoes_by_user,user,item);}
	if ((entry.uri) && (item!=entry)) item.uri=entry.uri;
	if ((entry.msg) && (item!=entry)) item.msg=entry.msg;
	if ((entry.excerpt) && (item!=entry)) item.excerpt=entry.excerpt;}}}
    sbook_allechoes.sort(function(x,y) {
      if ((x.id)<(y.id)) return -1;
      else if ((x.id)==(y.id))
	if ((x.tstamp)<(y.tstamp)) return -1;
	else if ((x.tstamp)===(y.tstamp)) return 0;
	else return 1;
      else return 1;});
}

function _sbook_createHUDSocial(id)
{
  var outer=fdjtDiv("sbookechoes"," ");
  var userbar=fdjtDiv("userbar");
  var addbutton=fdjtImage("addbutton.png","add");
  var users=fdjtDiv("users");
  fdjtAppend(userbar,addbutton,users);
  var entries=fdjtDiv("entries");  
  var i=0; while (i<sbook_allechoes.length) {
    var echo=sbook_allechoes[i++];
    var echo_elt=sbookEchoToEntry(echo);
    fdjtAppend(entries,echo_elt,"\n");}
  i=0; while (i<social_oids.length) {
    var oid=social_oids[i++];
    var img=fdjtImage(oid.squarepic,"user",oid.name);
    fdjtAppend(users,img);}
  if ($("SBOOKECHOESHUD"))
    fdjtReplace("SBOOKECHOESHUD",outer);
  else {
    if (!(id)) outer.id="SBOOKECHOESHUD";
    else outer.id=id;
    fdjtAppend(sbookHUD,outer);}
  return outer;
}

function sbookEchoToEntry(echo)
{
  var user=echo.user;
  var userinfo=social_info[user];
  fdjtLog("Converting echo %o, u=%o, i=%o",
	  echo,echo.user,social_info[echo.user]);
  var usrimg=fdjtImage(userinfo.squarepic,"userpic",userinfo.name);
  var userblock=fdjtDiv("userblock",usrimg);
  var msg=((echo.msg) ? fdjtDiv(echo.msg) : false);
  var excerpt=((echo.excerpt) ? fdjtDiv(echo.excerpt) : false);
  var echoinfo=fdjtDiv("userblock",msg,excerpt);
  var entry=fdjtDiv("entry",userblock,echoinfo);
  
}

/* Emacs local variables
;;;  Local variables: ***
;;;  compile-command: "cd ..; make" ***
;;;  End: ***
*/
