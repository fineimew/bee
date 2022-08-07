---
title: Emilia SSH Access
sidebar_label: Emilia SSH
---

In order to deploy OPQ to emilia.ics.hawaii.edu, you will generally need to configure ssh access to the opquser account. Here's how to do it.

## Obtain opquser account credentials

Most services are deployed using the opquser account.  You need to obtain the password for opquser on emilia in order to do this deployment.

## ssh without password prompt

In order to use the scripts to transfer files, you need to set up SSH login without a password.  You can follow [these instructions](http://www.linuxproblem.org/art_9.html).

To check to make sure you have set up your SSH keys correctly, bring up a new console and run the following command:

```
ssh -p 29862 opquser@emilia.ics.hawaii.edu
```

This should log you into emilia without prompting you for a password, with output like the following:

```
The programs included with the Debian GNU/Linux system are free software;
the exact distribution terms for each program are described in the
individual files in /usr/share/doc/*/copyright.

Debian GNU/Linux comes with ABSOLUTELY NO WARRANTY, to the extent
permitted by applicable law.
Last login: Sun Apr  8 07:57:57 2018 from cpe-66-91-216-204.hawaii.res.rr.com
opquser@emilia:~$
```

## ssh port forwarding

In certain situations, you may want to set up ssh port forwarding to create a port on your local machine that acts as if it was the MongoDB port on emilia.  To do this, open a new shell, and execute the following command:

```
$ ssh -C -p 29862 -N -L 27017:localhost:27017 opquser@emilia.ics.hawaii.edu
```

The shell will appear to "hang", but that's OK: it just means port forwarding has started. Type control-C to terminate port forwarding. 
