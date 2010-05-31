/* -*- Mode: Javascript; -*- */

var sbooks_social_id="$Id$";
var sbooks_social_version=parseInt("$Revision$".slice(10,-1));

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

/* Global variables */

var sbook_gloss_syncstamp=false;
var sbook_conversants=[];
var social_info={};

/* The Glosses/Social Database */

function sbookImportGlosses(data)
{
  var sbook_index=sbook.index;
  if (!(data))
    if (typeof sbook_gloss_data === "undefined") {
      fdjtLog("No gloss data available");
      return;}
    else {
      data=sbook_gloss_data;
      sbook_gloss_data=false;}
  var date=data['%date'];
  var info=data['%info'];
  if ((info) && (info.length)) {
    var i=0; while (i<info.length) {
      var item=info[i++]; var slots=sbook.sources.Import(item);
      if (!(slots.conversant)) {
	fdjtKB.add(sbook_conversants,slots.oid);
	sbookAddSourceIcon(slots);
	slots.conversant=true;}}}
  var ids=data['%ids'];
  if (sbook.Trace.network)
    fdjtLog("Importing gloss data %o for %d ids: %o",data,ids.length,ids);
  if ((ids) && (ids.length)) {
    var i=0; while (i<ids.length) {
      var id=ids[i++];
      var element=fdjtID(id);
      // Skip references to IDs which don't exist
      if (!(element)) continue;
      var entries=data[id];
      var need_glossmark=false;
      var j=0; while (j<entries.length) {
	var entry=entries[j++];
	var gloss=sbook_add_gloss(id,entry,sbook_index);
	if (!(entry.noglossmark)) need_glossmark=true;
	if (element.sbookloc) gloss.location=element.sbookloc;}
      if (need_glossmark) sbook.Glossmark(element);}}
}

function _sbook_add_glosses(glosses,etc,syncstamp)
{
  var sbook_index=sbook.index;
  var glossetc=sbook.glossetc;
  var allglosses=sbook.allglosses;
  var allsources=sbook.allsources;
  if (!(syncstamp)) syncstamp=fdjtTime();
  if ((etc) && (etc.length)) {
    var i=0; var lim=etc.length; while (i<lim) {
      var item=etc[i++]; var slots=sbook.sources.Import(item);
      var qid=slots.qid||slots.uuid||slots.oid;
      if ((sbook.offline)&&(qid)) {
	fdjtState.setLocal(qid,JSON.stringify(slots));
	glossetc[qid]=syncstamp;}
      allsources[qid]=qid;}}
  if (sbook.Trace.network)
    fdjtLog("Importing gloss data %o",glosses);
  if ((glosses) && (glosses.length)) {
    var i=0; var lim=glosses.length;
    while (i<lim) {
      var entry=glosses[i++];
      var id=entry.frag||entry.id;
      var element=fdjtID(id);
      // Skip references to IDs which don't exist
      if (!(element)) continue;
      var need_glossmark=false;
      var gloss=sbook_add_gloss(id,entry,sbook.index);
      allglosses[gloss.qid]=syncstamp;
      if (!(entry.noglossmark)) need_glossmark=true;
      if (need_glossmark) sbook.Glossmark(element);}}
  if (sbook.offline) {
    fdjtState.setLocal("glosses("+sbook.refuri+")",allglosses,true);
    fdjtState.setLocal("glossetc("+sbook.refuri+")",glossetc,true);
    fdjtState.setLocal("sources("+sbook.refuri+")",allsources,true);}
}
sbook.addGlosses=_sbook_add_glosses;

function sbook_add_gloss(id,entry,index)
{
  if (!(index)) index=sbook.index;
  if (!(entry.frag)) entry.frag=id;
  var item=sbook.glosses.Import(entry);
  var user=entry.user;
  var feed=entry.feed;
  if (entry.tags) {
    var tags=entry.tags; var dterms=[];
    var k=0; while (k<tags.length) {
      var tag=tags[k++]; var dterm=tag;
      if (typeof tag==='string')
	if (tag.indexOf('|')>=0)
	  dterm=sbook.knowlet.handleSubjectEntry(tag);
	else dterm=sbook.knowlet.probe(tag)||tag;
      dterms.push(dterm||tag);
      index.add(item,dterm,true,false,true,false);
      item.tags=dterms;}}
  else item.tags=[];
  item.taginfo=false;
  if (entry.user) if (item!=entry) item.user=user;
  var tstamp=entry.tstamp;
  if (tstamp>sbook.syncstamp) sbook.syncstamp=tstamp;
  if (user) sbookAddSourceIcon(user);
  if (feed) sbookAddSourceIcon(feed);
  return item;
}
function sbook_add_gloss(id,entry,index)
{
  return sbook.glosses.Import(entry);
}

function sbookGetSourcesUnder(idroot)
{
  var sources=[];
  var glosses=sbook.glosses.find('frag',idroot);
  var i=0; var lim=glosses.length;
  while (i<lim) {
    var gloss=glosses[i++];
    if (fdjtKB.position(sources,gloss.user)<0)
      sources.push(gloss.user);
    if (fdjtKB.position(sources,gloss.feed)<0)
      sources.push(gloss.feed);}
  return sources;
}

/* Callbacks */

function sbookNewGlosses(glosses,winarg)
{
  /* For when called from the iframe bridge */
  var win=winarg||window;
  sbookImportGlosses(glosses);
  var form=win.document.getElementById("SBOOKMARKFORM");
  fdjtDOM.dropClass(form,"submitting");
  form.reset();
  fdjtDOM.addListener
    (fdjtID("SBOOKMARKCLOUD"),"click",fdjtUI.Checkspan.onclick);
  win.sbookMode(false);
}

function sbookJSONPglosses(glosses)
{
  if (sbook.Trace.network)
    fdjtLog("Got new glosses (probably) from JSONP call");
  sbookNewGlosses(glosses);
}

/* Emacs local variables
;;;  Local variables: ***
;;;  compile-command: "cd ..; make" ***
;;;  End: ***
*/
