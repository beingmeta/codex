/* -*- Mode: Javascript; -*- */

var sbooks_social_id="$Id: domutils.js 40 2009-04-30 13:31:58Z haase $";
var sbooks_social_version=parseInt("$Revision: 40 $".slice(10,-1));

/* Copyright (C) 2009 beingmeta, inc.
   This file implements a Javascript/DHTML UI for reading
    large structured documents (sBooks).

   For more information on sbooks, visit www.sbooks.net
   For more information on knowlets, visit www.knowlets.net
   For more information about beingmeta, visit www.beingmeta.com

   This library uses the FDJT (www.fdjt.org) toolkit.

   This program comes with absolutely NO WARRANTY, including implied
   warranties of merchantability or fitness for any particular
   purpose.

    Use and redistribution (especially embedding in other
      CC licensed content) is permitted under the terms of the
      Creative Commons "Attribution-NonCommercial" license:

          http://creativecommons.org/licenses/by-nc/3.0/ 

    Other uses may be allowed based on prior agreement with
      beingmeta, inc.  Inquiries can be addressed to:

       licensing@beingmeta.com

   Enjoy!

*/

var social_oids=[];
var social_info={};
var sbook_allechoes=[];
var sbook_echoes_by_pingid={};
var sbook_echoes_by_user={};
var sbook_echoes_by_tags={};
var sbook_echoes_by_tribe={};
var sbook_echoes_by_id={};

function importSocialData(data)
{
  if (!(data))
    if (typeof sbook_echoes_data === "undefined") {
      fdjtLog("No social data available");
      return;}
    else data=sbook_echoes_data;
  var info=data['%info'];
  if ((info) && (info.length)) {
    var i=0; while (i<info.length) {
      var item=info[i++];
      fdjtLog("item=%o oid=%o",item,item.oid);
      if (!(social_info[item.oid])) social_oids.push(item.oid);
      social_info[item.oid]=item;}}
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
	  sbook_echoes_by_pingid[pingid]=entry;
	  item=entry;}
	item.fragid=id;
	fdjtAdd(sbook_echoes_by_id,id,item);
	if (entry.tags) {
	  var tags=entry.tags;
	  var k=0; while (k<tags.length) {
	    var tag=tags[k++];
	    if (item!=entry) fdjtAdd(item,'tags',tag,true);
	    fdjtAdd(sbook_echoes_by_tag,tag,item);}}
	else item.tags=[];
	if (entry.tribes) {
	  var tribes=entry.tribes;
	  var k=0; while (k<tribes.length) {
	    var tribe=tribes[k++];
	    if (item!=entry) fdjtAdd(item,'tribes',tribe,true);
	    fdjtAdd(sbook_echoes_by_tribe,tribe,item);}}
	else item.tribes=[];
	if (entry.user) {
	  if (item!=entry) item.user=user;
	  fdjtAdd(sbook_echoes_by_user,user,item);}
	if ((entry.uri) && (item!=entry)) item.uri=entry.uri;
	if ((entry.msg) && (item!=entry)) item.msg=entry.msg;
	if ((entry.excerpt) && (item!=entry)) item.excerpt=entry.excerpt;}}}
    sbook_allechoes.sort(function(x,y) {
      if ((x.fragid)<(y.fragid)) return -1;
      else if ((x.fragid)==(y.fragid))
	if ((x.tstamp)<(y.tstamp)) return -1;
	else if ((x.tstamp)===(y.tstamp)) return 0;
	else return 1;
      else return 1;});
}

function _sbook_social_setfocus(id)
{
  var tags=[]; var seen={};
  var echoes=(this.echoes)||
    (this.echoes=fdjtGetChildrenByClassName(this,"echo"));
  var i=0; while (i<echoes.length) {
    var echo=echoes[i++]; var fragid=echo.fragid;
    if ((fragid.search(id)===0)||(id.search(fragid)===0))  {
      var tags=echo.tags; var j=0; while (j<tags.length) {
	var tag=tags[j++]; if (!(seen[tag])) {
	  tags.push(tag); seen[tag]=tag;}}
      var tribes=echo.tribes; j=0; while (j<tribes.length) {
	var tribe=tribes[j++]; seen[tribe]=tribe;}
      var user=echo.user; seen[user]=user;
      echo.setAttribute('displayed','yes');}
    else echo.setAttribute('displayed','no');}
  var imagebar=fdjtGetChildrenByClassName(this,"imagebar")[0];
  var images=fdjtGetChildrenByTagName(imagebar,"IMG");
  var j=0; while (j<images.length) {
    var image=images[j++];
    if (seen[image.oid]) 
      image.setAttribute("displayed","yes");
    else image.setAttribute("displayed","no");}
}

function createSBOOKHUDsocial()
{
  var outer=fdjtDiv("sbookechoes"," ");
  var topbar=fdjtDiv("topbar");
  var addbutton=fdjtImage
    ("http://static.beingmeta.com/graphics/remarkballoon50x50.png",
     "addbutton","add");
  var imagebar=fdjtDiv("imagebar");
  fdjtAppend(topbar,addbutton,imagebar);
  var entries=fdjtDiv("echoes");  
  var i=0; while (i<sbook_allechoes.length) {
    var echo=sbook_allechoes[i++];
    var echo_elt=sbookEchoToEntry(echo);
    fdjtAppend(entries,echo_elt,"\n");}
  i=0; while (i<social_oids.length) {
    var oid=social_oids[i++];
    var info=social_info[oid];
    var img=fdjtImage(info.squarepic,"user",info.name);
    img.oid=oid; img.name=info.name;
    fdjtAppend(imagebar,img);}
  fdjtAppend(outer,topbar,entries);
  outer.id="SBOOKECHOES";
  outer.setFocus=_sbook_social_setfocus;
  return outer;
}

function sbookEchoToEntry(echo)
{
  var user=echo.user;
  var userinfo=social_info[user];
  var usrimg=fdjtImage(userinfo.squarepic,"userpic",userinfo.name);
  var userblock=fdjtDiv("userblock",usrimg);
  var icons=fdjtSpan("icons");
  var head=fdjtDiv("head");
  var core=fdjtDiv("core",
		   ((echo.msg) && (fdjtDiv("msg",echo.msg))),
		   ((echo.excerpt) && (fdjtDiv("excerpt",echo.excerpt))));
  var msg=((echo.msg) ? fdjtDiv("msg",echo.msg) : false);
  var excerpt=((echo.excerpt) ? fdjtDiv("excerpt",echo.excerpt) : false);
  var echoinfo=fdjtDiv("echoinfo",msg,excerpt);
  var entry=fdjtDiv("echo",userblock,echoinfo);
  entry.uri=echo.uri; entry.tags=echo.tags; entry.fragid=echo.fragid;
  entry.tribes=echo.tribes;
  return entry;
}

function createSBOOKHUDping()
{
  var iframe=fdjtNewElement("iframe","#SBOOKPING");
  iframe.src="";
  iframe.hspace=0; iframe.vspace=0;
  iframe.marginHeight=0; iframe.marginWidth=0;
  iframe.border=0; iframe.frameBorder=0;
  return iframe;
}

/* Invoking the iframe */

var sbook_echo_head=false;
var sbook_tribes=false;
function sbook_podspot_uri(uri,hash,title,tribes)
{
  var hashpos=uri.indexOf('#');
  fdjtTrace("Getting podspot for %s",uri);
  if ((hash) && (hashpos>=0))
    uri=uri.slice(0,hashpos)+'#'+hash;
  else if (hash) uri=uri+'#'+hash;
  var href=sbook_webechoes_root+"podspot.fdcgi?"+
    "IFRAME=yes&PODSPOT=yes&DIALOG=yes";
  if (uri) href=href+"&URI="+encodeURIComponent(uri);
  if (title) href=href+"&TITLE="+encodeURIComponent(title);
  if (tribes) {
    if ((typeof tribes === "string") && (tribes.indexOf(';')>0))
      tribes=tribes.split(';');
    if (typeof tribes === "string")
      href=href+"&TRIBE="+encodeURIComponent(tribes);
    else if ((typeof tribes === "object") && (tribes instanceof Array)) {
      var i=0; while (i<tribes.length) 
		 href=href+"&TRIBE="+encodeURIComponent(tribes[i++]);}
    else fdjtWarn("Weird TRIBES argument for podspot %o",tribes);}
  return href;
}

/* Emacs local variables
;;;  Local variables: ***
;;;  compile-command: "cd ..; make" ***
;;;  End: ***
*/
