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

// 'Database' elements
var sbook_allglosses=[];
var sbook_gloss_syncstamp=false;
var sbook_conversants=[];
var social_info={};
var sbook_glosses_by_glossid={};
var sbook_glosses_by_user={_all:[]};
var sbook_glosses_by_tag={_all:[]};
var sbook_glosses_by_xtag={};
var sbook_glosses_by_tribe={_all:[]};
var sbook_glosses_by_id={};

/* The Glosses/Social Database */

function sbookImportGlosses(data)
{
  var sbook_index=sbook.index;
  if (!(data))
    if (typeof sbook_gloss_data === "undefined") {
      fdjtLog("No gloss data available");
      return;}
    else data=sbook_gloss_data;
  var date=data['%date'];
  var info=data['%info'];
  if ((info) && (info.length)) {
    var i=0; while (i<info.length) {
      var item=info[i++]; var slots=sbook.OIDs.Import(item);
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
  sbook_allglosses.sort(function(x,y) {
      if ((x.id)<(y.id)) return -1;
      else if ((x.id)==(y.id))
	if ((x.tstamp)<(y.tstamp)) return -1;
	else if ((x.tstamp)===(y.tstamp)) return 0;
	else return 1;
      else return 1;});
}

function sbook_add_gloss(id,entry,index)
{
  if (!(index)) index=sbook.index;
  if (!(entry.frag)) entry.frag=id;
  var item=sbook.OIDs.Import(entry);
  var user=entry.user;
  var feed=entry.feed;
  if (!(item.pushed)) {
    sbook_allglosses.push(entry);
    item.pushed=true;}
  fdjtKB.add(sbook_glosses_by_id,id,item);
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
  if (entry.user) {
    if (item!=entry) item.user=user;
    fdjtKB.add(sbook_glosses_by_user,user,item);}
  var tstamp=entry.tstamp;
  if (tstamp>sbook_gloss_syncstamp) sbook_gloss_syncstamp=tstamp;
  if (fdjtID("SBOOKALLGLOSSES")) {
    var allglosses_div=fdjtID("SBOOKALLGLOSSES");
    sbookAddSummary(item,allglosses_div,false);}
  return item;
}

function sbookGetGlossesUnder(id)
{
  var results=[];
  var i=0; while (i<sbook_allglosses.length) {
    var gloss=sbook_allglosses[i++];
    var fragid=gloss.id;
    if (fragid.search(id)===0) results.push(gloss);}
  // fdjtTrace("Got %d glosses under %s",results.length,id);
  return results;
}

function sbookGetSourcesUnder(idroot)
{
  var sources=[];
  var glosses=sbook_glosses_by_id[idroot];
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

/* Searching glosses */

function sbook_search_glosses(query)
{
  var i=0; var results=false;
  while (i<query.length) {
    var q=query[i++];
    var glosses=sbook_glosses_by_tag[q]||(false);
    if (glosses)
      if (results)
	results=fdjtIntersect(results,glosses);
      else results=glosses;
    else {}}
  return results||[];
}

/* Emacs local variables
;;;  Local variables: ***
;;;  compile-command: "cd ..; make" ***
;;;  End: ***
*/
